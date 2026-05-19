import type { SearchResult } from "@/data/search-results";
import type { RecentItem } from "@/lib/recent-items";
import type { PoliceXmlItem } from "@/lib/police-openapi/types";
import type { PoliceGuideDetail } from "@/types/police-guide";

const LOST112_DETAIL_URL = "https://www.lost112.go.kr/find/findDetail.do";

function firstNonEmpty(...values: Array<string | undefined>) {
  return values.map((value) => value?.trim()).find(Boolean);
}

function normalizeDate(date?: string) {
  const value = date?.trim();

  if (!value) {
    return "날짜 정보 없음";
  }

  const compact = value.replace(/-/g, "");

  if (/^\d{8}$/.test(compact)) {
    return `${compact.slice(0, 4)}.${compact.slice(4, 6)}.${compact.slice(6, 8)}`;
  }

  return value;
}

function isNoImagePlaceholder(imageUrl?: string) {
  return !imageUrl || /no_img\.gif$/i.test(imageUrl);
}

function clampScore(score: number) {
  if (!Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(score <= 1 ? score * 100 : score)));
}

function formatMatchLabel(score: number) {
  const normalized = clampScore(score);
  return normalized >= 75 ? `매칭률 ${normalized}%` : "유사 후보";
}

export function getFoundItemDetailUrl(atcId: string, sequence?: string) {
  const params = new URLSearchParams({
    ATC_ID: atcId,
  });

  if (sequence) {
    params.set("FD_SN", sequence);
  }

  return `${LOST112_DETAIL_URL}?${params.toString()}`;
}

export function mapFoundItemToSearchResult(
  item: PoliceXmlItem,
  score: number,
  _matchedVia: string,
): SearchResult {
  void _matchedVia;

  const title = firstNonEmpty(item.fdPrdtNm, item.fdSbjt, item.prdtClNm) ?? "이름 없는 습득물";
  const imageUrl = isNoImagePlaceholder(item.fdFilePathImg)
    ? undefined
    : item.fdFilePathImg;

  return {
    id: item.atcId,
    source: item.sourceService === "portal" ? "portal" : "police",
    sequence: item.fdSn,
    title,
    location: firstNonEmpty(item.depPlace, item.orgNm, item.prdtClNm) ?? "보관 장소 확인 필요",
    pickupPlace: firstNonEmpty(item.fdPlace, item.addr),
    discoveredAt: normalizeDate(item.fdYmd),
    matchLabel: formatMatchLabel(score),
    confidence: clampScore(score) >= 82 ? "high" : "medium",
    imageUrl,
  };
}

export function mapFoundDetailToPoliceGuideDetail(
  item: PoliceXmlItem,
): PoliceGuideDetail {
  const atcId = item.atcId;
  const sequence = item.fdSn;
  const foundDate = item.fdYmd?.trim();
  const foundHour = item.fdHor?.trim();
  const foundDateTime = foundDate
    ? foundHour
      ? `${foundDate} ${foundHour}시`
      : foundDate
    : null;

  return {
    atcId,
    source: item.sourceService === "portal" ? "portal" : "police",
    sequence,
    detailUrl: getFoundItemDetailUrl(atcId, sequence),
    itemName: firstNonEmpty(item.fdPrdtNm, item.fdSbjt) ?? null,
    foundDateTime,
    foundPlace: item.fdPlace || null,
    category: item.prdtClNm || null,
    status: item.csteSteNm || null,
    detailDescription: item.uniq || null,
    receiptPlace: firstNonEmpty(item.orgNm, item.depPlace) ?? null,
    storagePlace: firstNonEmpty(item.depPlace, item.orgNm) ?? null,
    storagePhone: item.tel || null,
    managementNumber: sequence ? `${atcId}-${sequence}` : atcId,
  };
}

export function mapFoundItemsToRecentItems(items: PoliceXmlItem[]): RecentItem[] {
  return items.map((item) => {
    const imageUrl = isNoImagePlaceholder(item.fdFilePathImg)
      ? undefined
      : item.fdFilePathImg;
    const discoveredAt = normalizeDate(item.fdYmd);

    return {
      id: item.atcId,
      source: item.sourceService === "portal" ? "portal" : "police",
      sequence: item.fdSn,
      name: firstNonEmpty(item.fdPrdtNm, item.fdSbjt, item.prdtClNm) ?? "이름 없는 습득물",
      location: firstNonEmpty(item.depPlace, item.orgNm, item.prdtClNm) ?? "보관 장소 확인 필요",
      imageUrl,
      badgeLabel: discoveredAt,
      discoveredAt,
      pickupPlace: firstNonEmpty(item.fdPlace, item.addr),
    };
  });
}
