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
import { filterOpenFoundItems, isClosedFoundItem } from "@/lib/police-openapi/status";
import type { PoliceXmlItem, PoliceXmlResponse } from "@/lib/police-openapi/types";
import type { LostItemsSearchResult } from "@/lib/lost-items-search-shared";

type AgentInput = {
  query?: string;
  sessionId?: string;
  hasImage?: boolean;
  previousSlots?: Partial<SearchSlots>;
  seedSlots?: Partial<SearchSlots>;
};

export type FoundItemAgentTools = {
  searchFoundItemsByName: (input: {
    productName?: string;
    custodyPlace?: string;
    pageNo?: number;
    numOfRows?: number;
  }) => Promise<PoliceXmlResponse>;
  searchFoundItemsByLocation?: (input: {
    productName?: string;
    address?: string;
    pageNo?: number;
    numOfRows?: number;
  }) => Promise<PoliceXmlResponse>;
  searchFoundItemsByCategoryAreaPeriod?: (input: {
    category1?: string;
    category2?: string;
    colorCode?: string;
    startDate?: string;
    endDate?: string;
    locationCode?: string;
    pageNo?: number;
    numOfRows?: number;
  }) => Promise<PoliceXmlResponse>;
  getFoundItemDetail?: (input: {
    atcId: string;
    sequence: string;
    source?: "police" | "portal";
  }) => Promise<PoliceXmlResponse>;
  getFoundItemWebStatus?: (input: {
    atcId: string;
    sequence: string;
  }) => Promise<string | null>;
  rerankFoundItems?: (input: {
    query: string;
    slots: SearchSlots;
    items: RankedFoundItem[];
  }) => Promise<RankedFoundItem[] | null>;
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
  previousSlots: Annotation<Partial<SearchSlots> | undefined>,
  seedSlots: Annotation<Partial<SearchSlots> | undefined>,
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

function mergeSlots(
  previousSlots: Partial<SearchSlots> | undefined,
  currentSlots: Partial<SearchSlots>,
) {
  return removeUndefinedSlots({
    ...previousSlots,
    ...removeUndefinedSlots(currentSlots),
  });
}

function emptyPoliceResponse(): PoliceXmlResponse {
  return {
    header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
    items: [],
    pagination: {},
  };
}

async function runToolCall(
  toolCall: FoundItemSearchPlan["toolCalls"][number],
  tools: FoundItemAgentTools,
) {
  try {
    if (toolCall.tool === "searchFoundItemsByName") {
      return await tools.searchFoundItemsByName(toolCall.args);
    }

    if (
      toolCall.tool === "searchFoundItemsByLocation" &&
      tools.searchFoundItemsByLocation
    ) {
      return await tools.searchFoundItemsByLocation(toolCall.args);
    }

    if (
      toolCall.tool === "searchFoundItemsByCategoryAreaPeriod" &&
      tools.searchFoundItemsByCategoryAreaPeriod
    ) {
      return await tools.searchFoundItemsByCategoryAreaPeriod(toolCall.args);
    }
  } catch {
    return emptyPoliceResponse();
  }

  return emptyPoliceResponse();
}

async function verifyRankedItemsAreOpen(
  rankedItems: RankedFoundItem[],
  tools: FoundItemAgentTools,
) {
  const getFoundItemDetail = tools.getFoundItemDetail;
  const getFoundItemWebStatus = tools.getFoundItemWebStatus;

  if (!getFoundItemDetail && !getFoundItemWebStatus) {
    return rankedItems;
  }

  const checkedItems = await Promise.all(
    rankedItems.map(async (ranked) => {
      const sequence = ranked.item.fdSn ?? "1";

      try {
        const [detailResponse, webStatus] = await Promise.all([
          getFoundItemDetail
            ? getFoundItemDetail({
                atcId: ranked.item.atcId,
                sequence,
                source:
                  ranked.item.sourceService === "portal" ? "portal" : "police",
              })
            : Promise.resolve(null),
          getFoundItemWebStatus
            ? getFoundItemWebStatus({
                atcId: ranked.item.atcId,
                sequence,
              })
            : Promise.resolve(null),
        ]);
        const [detail] = detailResponse?.items ?? [];
        const statusCandidate = {
          csteSteNm: webStatus ?? detail?.csteSteNm ?? ranked.item.csteSteNm,
        };

        if (isClosedFoundItem(statusCandidate)) {
          return null;
        }

        return {
          ...ranked,
          item: {
            ...ranked.item,
            ...detail,
          },
        };
      } catch {
        return ranked;
      }
    }),
  );

  return checkedItems.filter((item): item is RankedFoundItem => item !== null);
}

async function rerankWithOptionalTool(
  rankedItems: RankedFoundItem[],
  state: Pick<AgentState, "normalizedQuery" | "slots">,
  tools: FoundItemAgentTools,
) {
  if (!tools.rerankFoundItems || rankedItems.length < 2 || !state.normalizedQuery) {
    return rankedItems;
  }

  try {
    const rerankedItems = await tools.rerankFoundItems({
      query: state.normalizedQuery,
      slots: state.slots,
      items: rankedItems,
    });

    if (!rerankedItems || rerankedItems.length === 0) {
      return rankedItems;
    }

    const originalByKey = new Map(
      rankedItems.map((ranked) => [
        `${ranked.item.atcId}:${ranked.item.fdSn ?? "1"}`,
        ranked,
      ]),
    );
    const seen = new Set<string>();
    const accepted = rerankedItems.filter((ranked) => {
      const key = `${ranked.item.atcId}:${ranked.item.fdSn ?? "1"}`;

      if (seen.has(key) || !originalByKey.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
    const remaining = rankedItems.filter((ranked) => {
      const key = `${ranked.item.atcId}:${ranked.item.fdSn ?? "1"}`;

      return !seen.has(key);
    });

    return [...accepted, ...remaining];
  } catch {
    return rankedItems;
  }
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
        location_hint: state.slots.address ?? state.slots.placeHint ?? null,
        date_hint: state.slots.dateFrom ?? null,
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
      location_hint: state.slots.address ?? state.slots.placeHint ?? null,
      date_hint: state.slots.dateFrom ?? null,
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
      const currentSlots = openAiSlots
        ? {
            ...rulePlan.slots,
            ...removeUndefinedSlots(openAiSlots),
          }
        : rulePlan.slots;
      const mergedSlots = mergeSlots(state.previousSlots, {
        ...currentSlots,
        ...removeUndefinedSlots(state.seedSlots ?? {}),
      });

      if (state.plan?.followUpQuestion && Object.keys(mergedSlots).length === 0) {
        return {
          plan: state.plan,
          slots: state.plan.slots,
        };
      }

      const plan = buildFoundItemSearchPlanFromSlots(mergedSlots);

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
        state.plan.toolCalls.map((toolCall) => runToolCall(toolCall, tools)),
      );

      return {
        rawItems: filterOpenFoundItems(
          deduplicateItems(responses.flatMap((response) => response.items)),
        ),
      };
    })
    .addNode("rankCandidates", async (state: AgentState) => ({
      rankedItems: rankFoundItems(state.rawItems, state.slots).slice(0, 9),
    }))
    .addNode("verifyOpenStatus", async (state: AgentState) => ({
      rankedItems: await verifyRankedItemsAreOpen(state.rankedItems, tools),
    }))
    .addNode("rerankWithLLM", async (state: AgentState) => ({
      rankedItems: await rerankWithOptionalTool(state.rankedItems, state, tools),
    }))
    .addNode("answerOrAskFollowUp", async (state: AgentState) => ({
      result: toResult(state),
    }))
    .addEdge(START, "normalizeInput")
    .addEdge("normalizeInput", "extractSlots")
    .addEdge("extractSlots", "searchFoundItems")
    .addEdge("searchFoundItems", "rankCandidates")
    .addEdge("rankCandidates", "verifyOpenStatus")
    .addEdge("verifyOpenStatus", "rerankWithLLM")
    .addEdge("rerankWithLLM", "answerOrAskFollowUp")
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
