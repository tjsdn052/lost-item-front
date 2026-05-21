import "server-only";

import {
  searchLostItemsByTextWithAgent,
  searchLostItemsWithAgent,
} from "@/lib/agent-api-client";
import type { LostItemsSearchResult } from "@/lib/lost-items-search-shared";

type SearchLostItemsInput = {
  query?: string;
  sessionId?: string;
  image?: File | null;
};

function emptyResult(sessionId?: string): LostItemsSearchResult {
  return {
    items: [],
    total: 0,
    sessionId,
    usedFallback: false,
  };
}

function failureResult(sessionId?: string): LostItemsSearchResult {
  return {
    items: [],
    total: 0,
    sessionId,
    assistantMessage:
      "검색 에이전트 서버에 연결하지 못했습니다. LOST_ITEM_AGENT_URL을 확인하고 FastAPI 에이전트를 실행한 뒤 다시 시도해 주세요.",
    usedFallback: false,
  };
}

export async function searchLostItems(
  input: SearchLostItemsInput,
): Promise<LostItemsSearchResult> {
  const query = input.query?.trim();
  const sessionId = input.sessionId?.trim() || undefined;
  const image = input.image ?? null;

  if (!query && !image) {
    return emptyResult(sessionId);
  }

  try {
    return await searchLostItemsWithAgent({ query, sessionId, image });
  } catch {
    return failureResult(sessionId);
  }
}

export async function searchLostItemsByText(
  query: string,
  sessionId?: string,
): Promise<LostItemsSearchResult> {
  const normalizedQuery = query.trim();
  const normalizedSessionId = sessionId?.trim() || undefined;

  if (!normalizedQuery) {
    return emptyResult(normalizedSessionId);
  }

  try {
    return await searchLostItemsByTextWithAgent(normalizedQuery, normalizedSessionId);
  } catch {
    return failureResult(normalizedSessionId);
  }
}
