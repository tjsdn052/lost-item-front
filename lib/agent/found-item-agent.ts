import { Annotation, END, START, StateGraph } from "@langchain/langgraph";
import { randomUUID } from "node:crypto";
import { assertSearchInputAllowed, sanitizeAssistantMessage } from "@/lib/agent/guardrails";
import {
  buildFoundItemSearchPlan,
  buildFoundItemSearchPlanFromSlots,
  rankFoundItems,
} from "@/lib/agent/search-strategy";
import { extractSearchSlotsWithOpenAI } from "@/lib/agent/openai-slot-extractor";
import type { FoundItemSearchPlan, RankedFoundItem, SearchSlots } from "@/lib/agent/state";
import { mapFoundItemToSearchResult } from "@/lib/police-openapi/mappers";
import type { PoliceXmlItem, PoliceXmlResponse } from "@/lib/police-openapi/types";
import type { LostItemsSearchResult } from "@/lib/lost-items-search-shared";

type AgentInput = {
  query?: string;
  sessionId?: string;
  hasImage?: boolean;
};

export type FoundItemAgentTools = {
  searchFoundItemsByName: (input: {
    productName?: string;
    custodyPlace?: string;
    pageNo?: number;
    numOfRows?: number;
  }) => Promise<PoliceXmlResponse>;
};

type AgentState = AgentInput & {
  normalizedQuery: string;
  plan: FoundItemSearchPlan | null;
  rawItems: PoliceXmlItem[];
  slots: SearchSlots;
  rankedItems: RankedFoundItem[];
  result: LostItemsSearchResult | null;
};

const FoundItemAgentState = Annotation.Root({
  query: Annotation<string | undefined>,
  sessionId: Annotation<string | undefined>,
  hasImage: Annotation<boolean | undefined>,
  normalizedQuery: Annotation<string>({
    value: (_left, right) => right,
    default: () => "",
  }),
  plan: Annotation<FoundItemSearchPlan | null>({
    value: (_left, right) => right,
    default: () => null,
  }),
  rawItems: Annotation<PoliceXmlItem[]>({
    value: (_left, right) => right,
    default: () => [],
  }),
  slots: Annotation<SearchSlots>({
    value: (_left, right) => right,
    default: () => ({}),
  }),
  rankedItems: Annotation<RankedFoundItem[]>({
    value: (_left, right) => right,
    default: () => [],
  }),
  result: Annotation<LostItemsSearchResult | null>({
    value: (_left, right) => right,
    default: () => null,
  }),
});

function deduplicateItems(items: PoliceXmlItem[]) {
  const seen = new Set<string>();
  const deduplicated: PoliceXmlItem[] = [];

  for (const item of items) {
    const key = `${item.atcId}:${item.fdSn ?? "1"}`;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduplicated.push(item);
  }

  return deduplicated;
}

function removeUndefinedSlots(slots: Partial<SearchSlots>) {
  return Object.fromEntries(
    Object.entries(slots).filter(([, value]) => value !== undefined),
  ) as Partial<SearchSlots>;
}

function toResult(state: AgentState): LostItemsSearchResult {
  const sessionId = state.sessionId || randomUUID();
  const plan = state.plan;

  if (plan?.followUpQuestion) {
    return {
      items: [],
      total: 0,
      sessionId,
      assistantMessage: sanitizeAssistantMessage(plan.followUpQuestion),
      queryMetadata: {
        item_type: state.slots.itemName ?? null,
        color: state.slots.color ?? null,
        location_hint: state.slots.placeHint ?? null,
      },
      usedFallback: false,
    };
  }

  const items = state.rankedItems.map((ranked) =>
    mapFoundItemToSearchResult(ranked.item, ranked.score, ranked.matchedVia),
  );

  return {
    items,
    total: items.length,
    sessionId,
    assistantMessage: items.length === 0
      ? "조건에 맞는 습득물 후보를 찾지 못했습니다. 물건 종류, 색상, 잃어버린 장소나 날짜를 조금 더 알려주세요."
      : null,
    queryMetadata: {
      item_type: state.slots.itemName ?? null,
      color: state.slots.color ?? null,
      location_hint: state.slots.placeHint ?? null,
    },
    usedFallback: false,
  };
}

export function createFoundItemAgent(tools: FoundItemAgentTools) {
  return new StateGraph(FoundItemAgentState)
    .addNode("normalizeInput", async (state: AgentState) => {
      assertSearchInputAllowed({
        query: state.query,
        hasImage: state.hasImage,
      });

      const normalizedQuery = state.query?.trim() ?? "";

      if (!normalizedQuery && state.hasImage) {
        return {
          normalizedQuery,
          plan: {
            slots: {},
            followUpQuestion:
              "이미지 검색은 아직 준비 중입니다. 물건 종류와 색상, 잃어버린 장소를 글로도 알려주세요.",
            toolCalls: [],
          },
        };
      }

      return { normalizedQuery };
    })
    .addNode("extractSlots", async (state: AgentState) => {
      const rulePlan = state.plan ?? buildFoundItemSearchPlan(state.normalizedQuery);
      const openAiSlots = await extractSearchSlotsWithOpenAI(state.normalizedQuery);
      const plan = openAiSlots
        ? buildFoundItemSearchPlanFromSlots({
            ...rulePlan.slots,
            ...removeUndefinedSlots(openAiSlots),
          })
        : rulePlan;

      return {
        plan,
        slots: plan.slots,
      };
    })
    .addNode("searchFoundItems", async (state: AgentState) => {
      if (!state.plan || state.plan.toolCalls.length === 0) {
        return { rawItems: [] };
      }

      const responses = await Promise.all(
        state.plan.toolCalls.map((toolCall) => {
          if (toolCall.tool === "searchFoundItemsByName") {
            return tools.searchFoundItemsByName(toolCall.args);
          }

          return Promise.resolve({
            header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
            items: [],
            pagination: {},
          });
        }),
      );

      return {
        rawItems: deduplicateItems(responses.flatMap((response) => response.items)),
      };
    })
    .addNode("rankCandidates", async (state: AgentState) => ({
      rankedItems: rankFoundItems(state.rawItems, state.slots).slice(0, 9),
    }))
    .addNode("answerOrAskFollowUp", async (state: AgentState) => ({
      result: toResult(state),
    }))
    .addEdge(START, "normalizeInput")
    .addEdge("normalizeInput", "extractSlots")
    .addEdge("extractSlots", "searchFoundItems")
    .addEdge("searchFoundItems", "rankCandidates")
    .addEdge("rankCandidates", "answerOrAskFollowUp")
    .addEdge("answerOrAskFollowUp", END)
    .compile();
}

export async function runFoundItemAgent(
  input: AgentInput,
  tools: FoundItemAgentTools,
) {
  const graph = createFoundItemAgent(tools);
  const state = await graph.invoke(input);

  if (!state.result) {
    throw new Error("검색 에이전트가 결과를 생성하지 못했습니다.");
  }

  return state.result;
}
