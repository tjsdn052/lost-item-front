import { describe, expect, it } from "vitest";
import {
  buildFoundItemSearchPlan,
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

  it("asks for the item name when the query is too vague", () => {
    expect(buildFoundItemSearchPlan("어제 잃어버렸어요")).toMatchObject({
      toolCalls: [],
      followUpQuestion: "어떤 물건을 잃어버리셨나요? 물건 종류를 먼저 알려주세요.",
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
});
