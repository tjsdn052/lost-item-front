import "server-only";

import { runFoundItemAgent } from "@/lib/agent/found-item-agent";
import { extractSearchSlotsFromImageWithOpenAI } from "@/lib/agent/openai-image-slot-extractor";
import { rerankFoundItemsWithOpenAI } from "@/lib/agent/openai-reranker";
import {
  getSessionSearchSlots,
  saveSessionSearchSlots,
} from "@/lib/agent/session-memory";
import type { SearchSlots } from "@/lib/agent/state";
import {
  createPoliceOpenApiClientFromEnv,
  createPortalFoundOpenApiClientFromEnv,
} from "@/lib/police-openapi/client";
import {
  mergeFoundItemResponses,
  tagFoundItemSource,
  type FoundItemSource,
} from "@/lib/police-openapi/sources";
import type { PoliceXmlResponse } from "@/lib/police-openapi/types";
import { fetchFoundItemWebStatus } from "@/lib/police-openapi/web-detail";
import type { LostItemsSearchResult } from "@/lib/lost-items-search-shared";
import type { SearchMetadata } from "@/lib/lost-items-search-shared";

type SearchLostItemsInput = {
  query?: string;
  sessionId?: string;
  image?: File | null;
};

function metadataToSlots(metadata: SearchMetadata | null | undefined) {
  if (!metadata) {
    return {};
  }

  return {
    itemName: metadata.item_type ?? undefined,
    color: metadata.color ?? undefined,
    address: metadata.location_hint ?? undefined,
    placeHint: metadata.location_hint ?? undefined,
    dateFrom: metadata.date_hint ?? undefined,
    dateTo: metadata.date_hint ?? undefined,
  } satisfies Partial<SearchSlots>;
}

type FoundItemClient = NonNullable<
  ReturnType<typeof createPoliceOpenApiClientFromEnv>
>;

async function querySources(
  sources: Array<{ source: FoundItemSource; client: FoundItemClient }>,
  query: (client: FoundItemClient) => Promise<PoliceXmlResponse>,
) {
  const settledResponses = await Promise.allSettled(
    sources.map(async ({ source, client }) =>
      tagFoundItemSource(await query(client), source),
    ),
  );
  const responses = settledResponses
    .filter((result): result is PromiseFulfilledResult<PoliceXmlResponse> =>
      result.status === "fulfilled",
    )
    .map((result) => result.value);

  return mergeFoundItemResponses(responses);
}

export async function searchLostItems(
  input: SearchLostItemsInput,
): Promise<LostItemsSearchResult> {
  const query = input.query?.trim();
  const sessionId = input.sessionId?.trim() || undefined;
  const image = input.image ?? null;
  const policeClient = createPoliceOpenApiClientFromEnv();
  const portalClient = createPortalFoundOpenApiClientFromEnv();
  const sources = [
    policeClient ? { source: "police" as const, client: policeClient } : null,
    portalClient ? { source: "portal" as const, client: portalClient } : null,
  ].filter(Boolean) as Array<{
    source: FoundItemSource;
    client: FoundItemClient;
  }>;

  try {
    if (!query && !image) {
      return {
        items: [],
        total: 0,
        usedFallback: false,
      };
    }

    if (sources.length === 0) {
      return {
        items: [],
        total: 0,
        sessionId,
        assistantMessage:
          "경찰청 공공데이터 인증키가 아직 설정되지 않았습니다. PUBLIC_DATA_API_KEY를 설정한 뒤 다시 검색해 주세요.",
        usedFallback: false,
      };
    }

    const seedSlots = await extractSearchSlotsFromImageWithOpenAI(image);
    const result = await runFoundItemAgent(
      {
        query,
        sessionId,
        hasImage: Boolean(image),
        previousSlots: getSessionSearchSlots(sessionId),
        seedSlots: seedSlots ?? undefined,
      },
      {
        searchFoundItemsByName: (toolInput) =>
          querySources(sources, (client) =>
            client.searchFoundItemsByName(toolInput),
          ),
        searchFoundItemsByLocation: (toolInput) =>
          querySources(sources, (client) =>
            client.searchFoundItemsByLocation(toolInput),
          ),
        searchFoundItemsByCategoryAreaPeriod: (toolInput) =>
          querySources(sources, (client) =>
            client.searchFoundItemsByCategoryAreaPeriod(toolInput),
          ),
        getFoundItemDetail: ({ atcId, sequence, source }) => {
          const matchedSource =
            sources.find((candidate) => candidate.source === source) ??
            sources[0];

          if (!matchedSource) {
            return Promise.resolve({
              header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
              pagination: {},
              items: [],
            });
          }

          return matchedSource.client.getFoundItemDetail({ atcId, sequence });
        },
        getFoundItemWebStatus: ({ atcId, sequence }) =>
          fetchFoundItemWebStatus({ atcId, sequence }),
        rerankFoundItems: (rerankInput) =>
          rerankFoundItemsWithOpenAI(rerankInput),
      },
    );

    saveSessionSearchSlots(
      result.sessionId ?? sessionId,
      metadataToSlots(result.queryMetadata),
    );

    return result;
  } catch {
    return {
      items: [],
      total: 0,
      sessionId,
      assistantMessage:
        "검색 요청을 처리하지 못했습니다. 잠시 후 다시 시도하거나 물건 종류, 색상, 장소를 더 구체적으로 입력해 주세요.",
      usedFallback: false,
    };
  }
}

export async function searchLostItemsByText(
  query: string,
  sessionId?: string,
): Promise<LostItemsSearchResult> {
  return searchLostItems({ query, sessionId });
}
