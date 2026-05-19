import type {
  FoundItemSearchPlan,
  RankedFoundItem,
  SearchSlots,
} from "@/lib/agent/state";
import type { PoliceXmlItem } from "@/lib/police-openapi/types";

type BuildSearchPlanOptions = {
  now?: Date;
};

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
const DATE_PATTERNS = [
  /(\d{4})\s*년\s*(\d{1,2})\s*월\s*(\d{1,2})\s*일/,
  /(\d{4})[.-](\d{1,2})[.-](\d{1,2})/,
  /(\d{4})(\d{2})(\d{2})/,
];

const CATEGORY_CODES: Record<string, Pick<SearchSlots, "category1" | "category2">> = {
  카드지갑: { category1: "PRH000", category2: "PRH200" },
  지갑: { category1: "PRH000", category2: "PRH200" },
};

const COLOR_CODES: Record<string, string> = {
  검정: "CL1002",
};

const LOCATION_CODES: Array<[RegExp, string]> = [
  [/(서울|강남|홍대|종로|성수|신촌|잠실|명동|건대|합정|망원)/, "LCA000"],
];

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

function padDatePart(value: string) {
  return value.padStart(2, "0");
}

function formatDate(year: string, month: string, day: string) {
  return `${year}${padDatePart(month)}${padDatePart(day)}`;
}

function formatDateFromDate(date: Date) {
  return formatDate(
    String(date.getFullYear()),
    String(date.getMonth() + 1),
    String(date.getDate()),
  );
}

function addDays(date: Date, days: number) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function extractRelativeDateRange(query: string, now = new Date()) {
  if (query.includes("그저께")) {
    const date = formatDateFromDate(addDays(now, -2));
    return { dateFrom: date, dateTo: date };
  }

  if (query.includes("어제")) {
    const date = formatDateFromDate(addDays(now, -1));
    return { dateFrom: date, dateTo: date };
  }

  if (query.includes("오늘")) {
    const date = formatDateFromDate(now);
    return { dateFrom: date, dateTo: date };
  }

  if (query.includes("지난주")) {
    return {
      dateFrom: formatDateFromDate(addDays(now, -7)),
      dateTo: formatDateFromDate(now),
    };
  }

  return {};
}

function extractDateRange(query: string, options: BuildSearchPlanOptions = {}) {
  for (const pattern of DATE_PATTERNS) {
    const match = query.match(pattern);

    if (match) {
      const date = formatDate(match[1], match[2], match[3]);
      return {
        dateFrom: date,
        dateTo: date,
      };
    }
  }

  return extractRelativeDateRange(query, options.now);
}

function normalizeSlotDate(date: string | undefined) {
  if (!date) {
    return undefined;
  }

  for (const pattern of DATE_PATTERNS) {
    const match = date.match(pattern);

    if (match) {
      return formatDate(match[1], match[2], match[3]);
    }
  }

  return undefined;
}

function normalizeSlots(slots: SearchSlots): SearchSlots {
  return enrichSlots({
    ...slots,
    dateFrom: normalizeSlotDate(slots.dateFrom),
    dateTo: normalizeSlotDate(slots.dateTo),
  });
}

function stripDateExpressions(value: string) {
  const withoutAbsoluteDates = DATE_PATTERNS.reduce(
    (current, pattern) => current.replace(pattern, " "),
    value,
  );

  return withoutAbsoluteDates.replace(/그저께|어제|오늘|지난주/g, " ");
}

function extractAddress(query: string, placeHint?: string) {
  const beforeLocationMarker = query.match(/(.{1,40}?)(?:에서|근처에서|부근에서)/)?.[1];

  if (!beforeLocationMarker) {
    return undefined;
  }

  const candidate = stripDateExpressions(beforeLocationMarker)
    .replace(/\b\d{1,2}\s*시\b/g, " ")
    .replace(/[,，]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!candidate || (placeHint && !candidate.includes(placeHint))) {
    return undefined;
  }

  const looksLikeAddress =
    /\s/.test(candidate) ||
    /(서울|부산|대구|인천|광주|대전|울산|세종|경기|강원|충북|충남|전북|전남|경북|경남|제주)/.test(candidate) ||
    /(역|구|동|로|길)$/.test(candidate);

  return looksLikeAddress ? candidate : undefined;
}

function resolveCategoryCodes(itemName: string | undefined) {
  if (!itemName) {
    return {};
  }

  return CATEGORY_CODES[itemName] ?? {};
}

function resolveColorCode(color: string | undefined) {
  return color ? COLOR_CODES[color] : undefined;
}

function resolveLocationCode(
  address: string | undefined,
  placeHint: string | undefined,
) {
  const target = [address, placeHint].filter(Boolean).join(" ");
  return LOCATION_CODES.find(([pattern]) => pattern.test(target))?.[1];
}

function enrichSlots(slots: SearchSlots): SearchSlots {
  return {
    ...slots,
    ...resolveCategoryCodes(slots.itemName),
    colorCode: resolveColorCode(slots.color),
    locationCode: resolveLocationCode(slots.address, slots.placeHint),
  };
}

function buildToolCalls(slots: SearchSlots): FoundItemSearchPlan["toolCalls"] {
  if (!slots.itemName) {
    return [];
  }

  const toolCalls: FoundItemSearchPlan["toolCalls"] = [
    {
      tool: "searchFoundItemsByName",
      args: {
        productName: slots.itemName,
        pageNo: 1,
        numOfRows: 20,
      },
    },
  ];

  if (slots.dateFrom || slots.dateTo) {
    toolCalls.push({
      tool: "searchFoundItemsByCategoryAreaPeriod",
      args: {
        category1: slots.category1,
        category2: slots.category2,
        colorCode: slots.colorCode,
        startDate: slots.dateFrom,
        endDate: slots.dateTo,
        locationCode: slots.locationCode,
        pageNo: 1,
        numOfRows: 20,
      },
    });
  }

  if (slots.address) {
    toolCalls.push({
      tool: "searchFoundItemsByLocation",
      args: {
        productName: slots.itemName,
        address: slots.address,
        pageNo: 1,
        numOfRows: 20,
      },
    });
  }

  return toolCalls;
}

export function buildFoundItemSearchPlan(
  query: string,
  options: BuildSearchPlanOptions = {},
): FoundItemSearchPlan {
  const normalizedQuery = query.trim();
  const dateRange = extractDateRange(normalizedQuery, options);
  const placeHint = extractPlaceHint(normalizedQuery);
  const slots: SearchSlots = enrichSlots({
    itemName: extractItemName(normalizedQuery),
    color: extractColor(normalizedQuery),
    placeHint,
    address: extractAddress(normalizedQuery, placeHint),
    ...dateRange,
  });

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
    toolCalls: buildToolCalls(slots),
  };
}

export function buildFoundItemSearchPlanFromSlots(
  inputSlots: SearchSlots,
): FoundItemSearchPlan {
  const slots = normalizeSlots(inputSlots);

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
    toolCalls: buildToolCalls(slots),
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

function normalizeDateValue(date: string | undefined) {
  if (!date) {
    return undefined;
  }

  const compact = date.replace(/\D/g, "");
  return compact.length >= 8 ? compact.slice(0, 8) : undefined;
}

function isWithinDateRange(date: string | undefined, slots: SearchSlots) {
  const normalized = normalizeDateValue(date);

  if (!normalized || (!slots.dateFrom && !slots.dateTo)) {
    return false;
  }

  return (
    (!slots.dateFrom || normalized >= slots.dateFrom) &&
    (!slots.dateTo || normalized <= slots.dateTo)
  );
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

      if (isWithinDateRange(item.fdYmd, slots)) {
        score += 0.08;
        matched.push("날짜");
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
