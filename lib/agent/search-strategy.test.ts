import { describe, expect, it } from "vitest";
import {
  buildFoundItemSearchPlan,
  buildFoundItemSearchPlanFromSlots,
  rankFoundItems,
} from "@/lib/agent/search-strategy";

describe("buildFoundItemSearchPlan", () => {
  it("extracts a Korean item name and location hint for name search", () => {
    expect(buildFoundItemSearchPlan("홍대에서 잃어버린 검은 지갑")).toMatchObject({
      slots: {
        itemName: "지갑",
        color: "검정",
        placeHint: "홍대",
      },
      followUpQuestion: null,
      toolCalls: [
        {
          tool: "searchFoundItemsByName",
          args: {
            productName: "지갑",
            numOfRows: 20,
            pageNo: 1,
          },
        },
      ],
    });
  });

  it("adds a location search tool and date slots when the lost description has address and date", () => {
    expect(
      buildFoundItemSearchPlan("2026년 5월 18일 서울 강남역 11번 출구 근처에서 잃어버린 검은 지갑"),
    ).toMatchObject({
      slots: {
        itemName: "지갑",
        color: "검정",
        placeHint: "강남",
        address: "서울 강남역 11번 출구",
        dateFrom: "20260518",
        dateTo: "20260518",
        colorCode: "CL1002",
        locationCode: "LCA000",
        category1: "PRH000",
        category2: "PRH200",
      },
      followUpQuestion: null,
      toolCalls: [
        {
          tool: "searchFoundItemsByName",
          args: {
            productName: "지갑",
            numOfRows: 20,
            pageNo: 1,
          },
        },
        {
          tool: "searchFoundItemsByCategoryAreaPeriod",
          args: {
            category1: "PRH000",
            category2: "PRH200",
            colorCode: "CL1002",
            startDate: "20260518",
            endDate: "20260518",
            locationCode: "LCA000",
            numOfRows: 20,
            pageNo: 1,
          },
        },
        {
          tool: "searchFoundItemsByLocation",
          args: {
            productName: "지갑",
            address: "서울 강남역 11번 출구",
            numOfRows: 20,
            pageNo: 1,
          },
        },
      ],
    });
  });

  it("asks for the item name when the query is too vague", () => {
    expect(buildFoundItemSearchPlan("어제 잃어버렸어요")).toMatchObject({
      toolCalls: [],
      followUpQuestion: "어떤 물건을 잃어버리셨나요? 물건 종류를 먼저 알려주세요.",
    });
  });

  it("converts relative Korean date hints from the provided base date", () => {
    expect(
      buildFoundItemSearchPlan("어제 강남역에서 잃어버린 지갑", {
        now: new Date("2026-05-19T12:00:00+09:00"),
      }),
    ).toMatchObject({
      slots: {
        dateFrom: "20260518",
        dateTo: "20260518",
      },
      toolCalls: [
        { tool: "searchFoundItemsByName" },
        {
          tool: "searchFoundItemsByCategoryAreaPeriod",
          args: {
            startDate: "20260518",
            endDate: "20260518",
          },
        },
        {
          tool: "searchFoundItemsByLocation",
          args: {
            address: "강남역",
          },
        },
      ],
    });
  });

  it("normalizes LLM date slots before creating period search calls", () => {
    expect(
      buildFoundItemSearchPlanFromSlots({
        itemName: "지갑",
        address: "서울 강남역",
        dateFrom: "2026-05-18",
        dateTo: "2026.05.18",
      }),
    ).toMatchObject({
      slots: {
        dateFrom: "20260518",
        dateTo: "20260518",
      },
      toolCalls: [
        {
          tool: "searchFoundItemsByName",
        },
        {
          tool: "searchFoundItemsByCategoryAreaPeriod",
          args: {
            startDate: "20260518",
            endDate: "20260518",
          },
        },
        {
          tool: "searchFoundItemsByLocation",
          args: {
            address: "서울 강남역",
          },
        },
      ],
    });
  });
});

describe("rankFoundItems", () => {
  it("ranks candidates by item name, color, place, and recency", () => {
    const ranked = rankFoundItems(
      [
        {
          atcId: "old",
          fdSn: "1",
          fdPrdtNm: "지갑",
          fdSbjt: "지갑(블랙(검정)색)",
          fdYmd: "2023-01-01",
          depPlace: "서울종로경찰서",
        },
        {
          atcId: "match",
          fdSn: "1",
          fdPrdtNm: "카드지갑",
          fdSbjt: "카드지갑(블랙(검정)색)",
          fdYmd: "2023-09-20",
          depPlace: "서울마포경찰서",
          fdPlace: "홍대입구역",
        },
      ],
      {
        itemName: "지갑",
        color: "검정",
        placeHint: "홍대",
      },
    );

    expect(ranked[0]).toMatchObject({
      item: { atcId: "match" },
      score: 0.95,
      matchedVia: "이름/색상/장소",
    });
  });

  it("boosts candidates that match the lost date range", () => {
    const ranked = rankFoundItems(
      [
        {
          atcId: "wrong-date",
          fdSn: "1",
          fdPrdtNm: "지갑",
          fdSbjt: "지갑(블랙(검정)색)",
          fdYmd: "2026-05-17",
          fdPlace: "강남역",
        },
        {
          atcId: "right-date",
          fdSn: "1",
          fdPrdtNm: "지갑",
          fdSbjt: "지갑(블랙(검정)색)",
          fdYmd: "2026-05-18",
          fdPlace: "강남역",
        },
      ],
      {
        itemName: "지갑",
        color: "검정",
        placeHint: "강남",
        dateFrom: "20260518",
        dateTo: "20260518",
      },
    );

    expect(ranked[0]).toMatchObject({
      item: { atcId: "right-date" },
      matchedVia: "이름/색상/장소/날짜",
    });
  });
});
