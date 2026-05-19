import "server-only";

import { runFoundItemAgent } from "@/lib/agent/found-item-agent";
import { createPoliceOpenApiClientFromEnv } from "@/lib/police-openapi/client";
import type { LostItemsSearchResult } from "@/lib/lost-items-search-shared";

type SearchLostItemsInput = {
  query?: string;
  sessionId?: string;
  image?: File | null;
};

export async function searchLostItems(
  input: SearchLostItemsInput,
): Promise<LostItemsSearchResult> {
  const query = input.query?.trim();
  const sessionId = input.sessionId?.trim() || undefined;
  const image = input.image ?? null;
  const client = createPoliceOpenApiClientFromEnv();

  try {
    if (!query && !image) {
      return {
        items: [],
        total: 0,
        usedFallback: false,
      };
    }

    if (!client) {
      return {
        items: [],
        total: 0,
        sessionId,
        assistantMessage:
          "경찰청 공공데이터 인증키가 아직 설정되지 않았습니다. PUBLIC_DATA_API_KEY를 설정한 뒤 다시 검색해 주세요.",
        usedFallback: false,
      };
    }

    return await runFoundItemAgent(
      {
        query,
        sessionId,
        hasImage: Boolean(image),
      },
      {
        searchFoundItemsByName: client.searchFoundItemsByName,
      },
    );
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
