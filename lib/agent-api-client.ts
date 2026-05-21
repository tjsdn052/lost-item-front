import "server-only";

import type { SearchResult } from "@/data/search-results";
import type { LostItemsSearchResult } from "@/lib/lost-items-search-shared";
import type { PoliceGuideResponse } from "@/types/police-guide";

type SearchLostItemsInput = {
  query?: string;
  sessionId?: string;
  image?: File | null;
};

type PoliceGuideRequest = {
  atcId?: string;
  item?: SearchResult;
};

function getAgentBaseUrl() {
  const baseUrl = process.env.LOST_ITEM_AGENT_URL?.trim();

  if (!baseUrl) {
    throw new Error("LOST_ITEM_AGENT_URL is required.");
  }

  return baseUrl.replace(/\/$/, "");
}

async function requestJson<TResponse>(
  path: string,
  init: RequestInit,
): Promise<TResponse> {
  const response = await fetch(`${getAgentBaseUrl()}${path}`, {
    ...init,
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Agent API request failed: ${response.status}`);
  }

  return (await response.json()) as TResponse;
}

export function searchLostItemsByTextWithAgent(
  query: string,
  sessionId?: string,
) {
  return requestJson<LostItemsSearchResult>("/search/text", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, sessionId }),
  });
}

export function searchLostItemsWithAgent(input: SearchLostItemsInput) {
  const formData = new FormData();

  if (input.query) {
    formData.set("query", input.query);
  }

  if (input.sessionId) {
    formData.set("sessionId", input.sessionId);
  }

  if (input.image) {
    formData.set("file", input.image);
  }

  return requestJson<LostItemsSearchResult>("/search/submit", {
    method: "POST",
    body: formData,
  });
}

export function fetchPoliceGuideFromAgent(input: PoliceGuideRequest) {
  return requestJson<PoliceGuideResponse>("/police-guide", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
}
