import type {
  FoundItemSearchPlan,
  RankedFoundItem,
  SearchSlots,
} from "@/lib/agent/state";
import type { PoliceXmlItem } from "@/lib/police-openapi/types";

const ITEM_NAMES = [
  "카드지갑",
  "지갑",
  "에어팟",
  "이어폰",
  "휴대폰",
  "핸드폰",
  "가방",
  "백팩",
  "파우치",
  "노트북",
  "우산",
  "시계",
  "카드",
];

const COLOR_ALIASES: Array<[string, string]> = [
  ["검은", "검정"],
  ["검정", "검정"],
  ["블랙", "검정"],
  ["흰", "흰색"],
  ["하얀", "흰색"],
  ["화이트", "흰색"],
  ["빨간", "빨강"],
  ["레드", "빨강"],
  ["파란", "파랑"],
  ["블루", "파랑"],
  ["초록", "초록"],
  ["그린", "초록"],
];

const PLACE_HINTS = ["홍대", "강남", "잠실", "신촌", "성수", "종로", "명동", "건대", "합정", "망원"];

function includesNormalized(source: string | undefined, target: string | undefined) {
  if (!source || !target) {
    return false;
  }

  return source.replace(/\s/g, "").includes(target.replace(/\s/g, ""));
}

function extractItemName(query: string) {
  return ITEM_NAMES.find((itemName) => query.includes(itemName));
}

function extractColor(query: string) {
  return COLOR_ALIASES.find(([alias]) => query.includes(alias))?.[1];
}

function extractPlaceHint(query: string) {
  return PLACE_HINTS.find((place) => query.includes(place));
}

export function buildFoundItemSearchPlan(query: string): FoundItemSearchPlan {
  const normalizedQuery = query.trim();
  const slots: SearchSlots = {
    itemName: extractItemName(normalizedQuery),
    color: extractColor(normalizedQuery),
    placeHint: extractPlaceHint(normalizedQuery),
  };

  if (!slots.itemName) {
    return {
      slots,
      followUpQuestion: "어떤 물건을 잃어버리셨나요? 물건 종류를 먼저 알려주세요.",
      toolCalls: [],
    };
  }

  return {
    slots,
    followUpQuestion: null,
    toolCalls: [
      {
        tool: "searchFoundItemsByName",
        args: {
          productName: slots.itemName,
          pageNo: 1,
          numOfRows: 20,
        },
      },
    ],
  };
}

export function buildFoundItemSearchPlanFromSlots(
  slots: SearchSlots,
): FoundItemSearchPlan {
  if (!slots.itemName) {
    return {
      slots,
      followUpQuestion: "어떤 물건을 잃어버리셨나요? 물건 종류를 먼저 알려주세요.",
      toolCalls: [],
    };
  }

  return {
    slots,
    followUpQuestion: null,
    toolCalls: [
      {
        tool: "searchFoundItemsByName",
        args: {
          productName: slots.itemName,
          pageNo: 1,
          numOfRows: 20,
        },
      },
    ],
  };
}

function buildHaystack(item: PoliceXmlItem) {
  return [
    item.fdPrdtNm,
    item.fdSbjt,
    item.depPlace,
    item.fdPlace,
    item.addr,
    item.prdtClNm,
    item.clrNm,
  ]
    .filter(Boolean)
    .join(" ");
}

function getTimestamp(date: string | undefined) {
  if (!date) {
    return 0;
  }

  const time = Date.parse(date);
  return Number.isFinite(time) ? time : 0;
}

export function rankFoundItems(
  items: PoliceXmlItem[],
  slots: SearchSlots,
): RankedFoundItem[] {
  const latestTimestamp = Math.max(...items.map((item) => getTimestamp(item.fdYmd)), 0);

  return items
    .map((item) => {
      const haystack = buildHaystack(item);
      const matched: string[] = [];
      let score = 0.45;

      if (includesNormalized(haystack, slots.itemName)) {
        score += 0.2;
        matched.push("이름");
      }

      if (includesNormalized(haystack, slots.color)) {
        score += 0.15;
        matched.push("색상");
      }

      if (includesNormalized(haystack, slots.placeHint)) {
        score += 0.12;
        matched.push("장소");
      }

      if (latestTimestamp && getTimestamp(item.fdYmd) === latestTimestamp) {
        score += 0.03;
      }

      return {
        item,
        score: Math.min(0.95, Number(score.toFixed(2))),
        matchedVia: matched.length > 0 ? matched.join("/") : "기본",
      };
    })
    .sort((left, right) => right.score - left.score);
}
