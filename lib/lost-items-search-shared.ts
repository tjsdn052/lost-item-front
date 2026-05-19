import type { SearchResult } from "@/data/search-results";

export const DEFAULT_TOP_K = 9;
const SUPPORTED_IMAGE_HOSTS = new Set([
  "lh3.googleusercontent.com",
  "52.79.250.143",
]);

export type LostItemApiResult = {
  atc_id: string;
  fd_prdt_nm: string;
  fd_sbjt: string;
  prdt_cl_nm: string;
  dep_place: string;
  fd_ymd: string;
  image_url?: string | null;
  pkup_plc_se_nm?: string | null;
  score: number;
  matched_via: string;
};

export type SearchMetadata = {
  item_type?: string | null;
  color?: string | null;
  material?: string | null;
  brand?: string | null;
  location_hint?: string | null;
  date_hint?: string | null;
};

export type SearchSourceCounts = {
  police: number;
  portal: number;
};

export type SearchSourceBreakdown = {
  raw: SearchSourceCounts;
  afterStatusFilter: SearchSourceCounts;
  final: SearchSourceCounts;
};

export type SearchApiResponse = {
  items: LostItemApiResult[];
  total: number;
  session_id?: string | null;
  assistant_message?: string | null;
  agent_reasoning?: string | null;
  query_metadata?: SearchMetadata | null;
  source_breakdown?: SearchSourceBreakdown | null;
  search_time_ms: number;
};

export type LostItemsSearchResult = {
  items: SearchResult[];
  total: number;
  sessionId?: string | null;
  assistantMessage?: string | null;
  agentReasoning?: string | null;
  queryMetadata?: SearchMetadata | null;
  sourceBreakdown?: SearchSourceBreakdown | null;
  searchTimeMs?: number;
  usedFallback: boolean;
};

function isSupportedImageUrl(imageUrl?: string | null) {
  if (!imageUrl) {
    return false;
  }

  try {
    const parsedUrl = new URL(imageUrl);
    return SUPPORTED_IMAGE_HOSTS.has(parsedUrl.hostname);
  } catch {
    return false;
  }
}

function getImageFileName(imageUrl: string) {
  const rawFileName = imageUrl.split(/[\\/]/).pop();

  if (!rawFileName) {
    return null;
  }

  return rawFileName.replace(/\.[^.]+$/, "");
}

export function buildPublicImageUrl(
  imageUrl: string | null | undefined,
  apiBaseUrl: string,
) {
  if (!imageUrl) {
    return undefined;
  }

  if (isSupportedImageUrl(imageUrl)) {
    return imageUrl;
  }

  const fileName = getImageFileName(imageUrl);

  if (!fileName) {
    return undefined;
  }

  return `${apiBaseUrl}/api/v1/images/${encodeURIComponent(fileName)}`;
}

function formatMatchLabel(score: number, matchedVia: string) {
  const normalizedScore = score <= 1 ? score * 100 : score;
  const roundedScore = Math.max(0, Math.min(99, Math.round(normalizedScore)));

  if (matchedVia.includes("image")) {
    return `이미지 매칭 ${roundedScore}%`;
  }

  if (matchedVia.includes("text")) {
    return `매칭률 ${roundedScore}%`;
  }

  return `유사도 ${roundedScore}%`;
}

function formatDiscoveredAt(dateString: string) {
  if (!dateString) {
    return "날짜 정보 없음";
  }

  const [year, month, day] = dateString.split("-");

  if (!year || !month || !day) {
    return dateString;
  }

  return `${year}.${month}.${day}`;
}

function mapConfidence(score: number): SearchResult["confidence"] {
  return score >= 0.82 ? "high" : "medium";
}

export function mapSearchApiResponse(
  data: SearchApiResponse,
  apiBaseUrl: string,
): LostItemsSearchResult {
  return {
    items: data.items.map((item) => ({
      id: item.atc_id,
      title: item.fd_prdt_nm || item.fd_sbjt || "이름 없는 분실물",
      location: item.dep_place || item.prdt_cl_nm || "보관 장소 확인 필요",
      pickupPlace: item.pkup_plc_se_nm || undefined,
      discoveredAt: formatDiscoveredAt(item.fd_ymd),
      matchLabel: formatMatchLabel(item.score, item.matched_via),
      confidence: mapConfidence(item.score),
      imageUrl: buildPublicImageUrl(item.image_url, apiBaseUrl),
    })),
    total: data.total,
    sessionId: data.session_id,
    assistantMessage: data.assistant_message,
    agentReasoning: data.agent_reasoning,
    queryMetadata: data.query_metadata,
    sourceBreakdown: data.source_breakdown,
    searchTimeMs: data.search_time_ms,
    usedFallback: false,
  };
}
