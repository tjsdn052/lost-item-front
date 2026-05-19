import { describe, expect, it, vi } from "vitest";
import { runFoundItemAgent } from "@/lib/agent/found-item-agent";

describe("runFoundItemAgent", () => {
  it("searches found items and returns mapped card candidates", async () => {
    const result = await runFoundItemAgent(
      {
        query: "홍대에서 잃어버린 검은 지갑",
        sessionId: "session-1",
      },
      {
        searchFoundItemsByName: vi.fn(async () => ({
          header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
          pagination: { totalCount: 1 },
          items: [
        {
          atcId: "F1",
          sourceService: "portal",
          fdSn: "1",
          fdPrdtNm: "카드지갑",
              fdSbjt: "카드지갑(블랙(검정)색)",
              fdYmd: "2023-09-20",
              depPlace: "서울마포경찰서",
              fdPlace: "홍대입구역",
            },
          ],
        })),
      },
    );

    expect(result).toMatchObject({
      total: 1,
      sessionId: "session-1",
      assistantMessage: null,
      items: [
        {
          id: "F1",
          source: "portal",
          sequence: "1",
          title: "카드지갑",
          matchLabel: "매칭률 95%",
          confidence: "high",
        },
      ],
      usedFallback: false,
    });
  });

  it("returns a follow-up message when the query is too vague", async () => {
    const result = await runFoundItemAgent(
      {
        query: "어제 잃어버렸어요",
      },
      {
        searchFoundItemsByName: vi.fn(),
      },
    );

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.assistantMessage).toBe(
      "어떤 물건을 잃어버리셨나요? 물건 종류를 먼저 알려주세요.",
    );
  });

  it("deduplicates candidates by atcId and fdSn", async () => {
    const result = await runFoundItemAgent(
      {
        query: "검은 지갑",
      },
      {
        searchFoundItemsByName: vi.fn(async () => ({
          header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
          pagination: { totalCount: 2 },
          items: [
            {
              atcId: "F1",
              fdSn: "1",
              fdPrdtNm: "지갑",
              fdSbjt: "지갑(블랙(검정)색)",
              fdYmd: "2023-09-20",
            },
            {
              atcId: "F1",
              fdSn: "1",
              fdPrdtNm: "지갑",
              fdSbjt: "지갑(블랙(검정)색)",
              fdYmd: "2023-09-20",
            },
          ],
        })),
      },
    );

    expect(result.items).toHaveLength(1);
  });

  it("reranks verified candidates with an LLM reranker when available", async () => {
    const rerankFoundItems = vi.fn(async ({ items }) => [
      items.find((ranked) => ranked.item.atcId === "SEMANTIC_MATCH")!,
      items.find((ranked) => ranked.item.atcId === "KEYWORD_MATCH")!,
    ]);

    const result = await runFoundItemAgent(
      {
        query: "서울 강남역에서 잃어버린 검은 지갑",
      },
      {
        searchFoundItemsByName: vi.fn(async () => ({
          header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
          pagination: { totalCount: 2 },
          items: [
            {
              atcId: "KEYWORD_MATCH",
              fdSn: "1",
              fdPrdtNm: "검정 지갑",
              fdSbjt: "검정 지갑",
              fdPlace: "종로",
            },
            {
              atcId: "SEMANTIC_MATCH",
              fdSn: "1",
              fdPrdtNm: "지갑",
              fdSbjt: "카드와 신분증이 들어있는 반지갑",
              fdPlace: "서울 강남역 11번 출구",
            },
          ],
        })),
        rerankFoundItems,
      } as Parameters<typeof runFoundItemAgent>[1],
    );

    expect(rerankFoundItems).toHaveBeenCalledWith({
      query: "서울 강남역에서 잃어버린 검은 지갑",
      slots: expect.objectContaining({
        itemName: "지갑",
        color: "검정",
      }),
      items: expect.arrayContaining([
        expect.objectContaining({
          item: expect.objectContaining({ atcId: "KEYWORD_MATCH" }),
        }),
        expect.objectContaining({
          item: expect.objectContaining({ atcId: "SEMANTIC_MATCH" }),
        }),
      ]),
    });
    expect(result.items[0]).toMatchObject({ id: "SEMANTIC_MATCH" });
  });

  it("reports source counts before filtering, after filtering, and in final results", async () => {
    const result = await runFoundItemAgent(
      {
        query: "검은 지갑",
      },
      {
        searchFoundItemsByName: vi.fn(async () => ({
          header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
          pagination: { totalCount: 3 },
          items: [
            {
              atcId: "POLICE_OPEN",
              sourceService: "police",
              fdSn: "1",
              fdPrdtNm: "지갑",
              fdSbjt: "검정 지갑",
              csteSteNm: "보관중",
            },
            {
              atcId: "PORTAL_CLOSED",
              sourceService: "portal",
              fdSn: "1",
              fdPrdtNm: "지갑",
              fdSbjt: "검정 지갑",
              csteSteNm: "종결",
            },
            {
              atcId: "PORTAL_OPEN",
              sourceService: "portal",
              fdSn: "1",
              fdPrdtNm: "지갑",
              fdSbjt: "검정 지갑",
              csteSteNm: "보관중",
            },
          ],
        })),
        getFoundItemWebStatus: vi.fn(async ({ atcId }) =>
          atcId === "PORTAL_OPEN" ? "반환완료" : "보관중",
        ),
      },
    );

    expect(result.sourceBreakdown).toEqual({
      raw: { police: 1, portal: 2 },
      afterStatusFilter: { police: 1, portal: 1 },
      final: { police: 1, portal: 0 },
    });
  });

  it("excludes candidates whose found item status is closed", async () => {
    const result = await runFoundItemAgent(
      {
        query: "검은 지갑",
      },
      {
        searchFoundItemsByName: vi.fn(async () => ({
          header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
          pagination: { totalCount: 2 },
          items: [
            {
              atcId: "OPEN",
              fdSn: "1",
              fdPrdtNm: "지갑",
              fdSbjt: "검정 지갑",
              csteSteNm: "보관중",
            },
            {
              atcId: "CLOSED",
              fdSn: "1",
              fdPrdtNm: "지갑",
              fdSbjt: "검정 지갑",
              csteSteNm: "종결",
            },
          ],
        })),
      },
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: "OPEN" });
  });

  it("checks detail status when list candidates do not include status", async () => {
    const result = await runFoundItemAgent(
      {
        query: "검은 지갑",
      },
      {
        searchFoundItemsByName: vi.fn(async () => ({
          header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
          pagination: { totalCount: 2 },
          items: [
            {
              atcId: "OPEN_DETAIL",
              fdSn: "1",
              fdPrdtNm: "지갑",
              fdSbjt: "검정 지갑",
            },
            {
              atcId: "CLOSED_DETAIL",
              fdSn: "1",
              fdPrdtNm: "지갑",
              fdSbjt: "검정 지갑",
            },
          ],
        })),
        getFoundItemDetail: vi.fn(async ({ atcId }) => ({
          header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
          pagination: { totalCount: 1 },
          items: [
            {
              atcId,
              fdSn: "1",
              fdPrdtNm: "지갑",
              csteSteNm: atcId === "CLOSED_DETAIL" ? "종결" : "보관중",
            },
          ],
        })),
      },
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: "OPEN_DETAIL" });
  });

  it("excludes candidates when the lost112 web detail status is closed even if OpenAPI says open", async () => {
    const result = await runFoundItemAgent(
      {
        query: "검은 지갑",
      },
      {
        searchFoundItemsByName: vi.fn(async () => ({
          header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
          pagination: { totalCount: 2 },
          items: [
            {
              atcId: "WEB_OPEN",
              fdSn: "1",
              fdPrdtNm: "지갑",
              fdSbjt: "검정 지갑",
            },
            {
              atcId: "WEB_CLOSED",
              fdSn: "1",
              fdPrdtNm: "지갑",
              fdSbjt: "검정 지갑",
            },
          ],
        })),
        getFoundItemDetail: vi.fn(async ({ atcId }) => ({
          header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
          pagination: { totalCount: 1 },
          items: [
            {
              atcId,
              fdSn: "1",
              fdPrdtNm: "지갑",
              csteSteNm: "보관중",
            },
          ],
        })),
        getFoundItemWebStatus: vi.fn(async ({ atcId }) =>
          atcId === "WEB_CLOSED" ? "종결" : "보관중",
        ),
      },
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ id: "WEB_OPEN" });
  });

  it("searches by both item name and address when the description includes a location", async () => {
    const searchFoundItemsByName = vi.fn(async () => ({
      header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
      pagination: { totalCount: 1 },
      items: [
        {
          atcId: "NAME_ONLY",
          fdSn: "1",
          fdPrdtNm: "지갑",
          fdSbjt: "지갑",
          fdYmd: "2026-05-18",
          fdPlace: "종로",
        },
      ],
    }));
    const searchFoundItemsByLocation = vi.fn(async () => ({
      header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
      pagination: { totalCount: 1 },
      items: [
        {
          atcId: "LOCATION_MATCH",
          fdSn: "1",
          fdPrdtNm: "지갑",
          fdSbjt: "지갑(검정색)",
          fdYmd: "2026-05-18",
          fdPlace: "서울 강남역",
        },
      ],
    }));
    const searchFoundItemsByCategoryAreaPeriod = vi.fn(async () => ({
      header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
      pagination: { totalCount: 1 },
      items: [
        {
          atcId: "DATE_MATCH",
          fdSn: "1",
          fdPrdtNm: "지갑",
          fdSbjt: "지갑",
          fdYmd: "2026-05-18",
          fdPlace: "강남",
        },
      ],
    }));

    const result = await runFoundItemAgent(
      {
        query: "2026년 5월 18일 서울 강남역에서 잃어버린 검은 지갑",
      },
      {
        searchFoundItemsByName,
        searchFoundItemsByLocation,
        searchFoundItemsByCategoryAreaPeriod,
      },
    );

    expect(searchFoundItemsByName).toHaveBeenCalledWith({
      productName: "지갑",
      pageNo: 1,
      numOfRows: 20,
    });
    expect(searchFoundItemsByCategoryAreaPeriod).toHaveBeenCalledWith({
      category1: "PRH000",
      category2: "PRH200",
      colorCode: "CL1002",
      startDate: "20260518",
      endDate: "20260518",
      locationCode: "LCA000",
      pageNo: 1,
      numOfRows: 20,
    });
    expect(searchFoundItemsByLocation).toHaveBeenCalledWith({
      productName: "지갑",
      address: "서울 강남역",
      pageNo: 1,
      numOfRows: 20,
    });
    expect(result.items[0]).toMatchObject({
      id: "LOCATION_MATCH",
      matchLabel: "매칭률 95%",
    });
  });

  it("keeps primary name-search results when a supplemental tool fails", async () => {
    const result = await runFoundItemAgent(
      {
        query: "2026년 5월 18일 서울 강남역에서 잃어버린 검은 지갑",
      },
      {
        searchFoundItemsByName: vi.fn(async () => ({
          header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
          pagination: { totalCount: 1 },
          items: [
            {
              atcId: "NAME_MATCH",
              fdSn: "1",
              fdPrdtNm: "지갑",
              fdSbjt: "검정 지갑",
              fdYmd: "2026-05-18",
              fdPlace: "강남역",
            },
          ],
        })),
        searchFoundItemsByCategoryAreaPeriod: vi.fn(async () => {
          throw new Error("period api failed");
        }),
        searchFoundItemsByLocation: vi.fn(async () => {
          throw new Error("location api failed");
        }),
      },
    );

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({
      id: "NAME_MATCH",
    });
  });

  it("merges previous session slots when the next query only changes the item", async () => {
    const searchFoundItemsByLocation = vi.fn(async () => ({
      header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
      pagination: { totalCount: 1 },
      items: [
        {
          atcId: "AIRPODS",
          fdSn: "1",
          fdPrdtNm: "에어팟",
          fdSbjt: "에어팟",
          fdYmd: "2026-05-18",
          fdPlace: "서울 강남역",
        },
      ],
    }));

    await runFoundItemAgent(
      {
        query: "에어팟",
        previousSlots: {
          itemName: "지갑",
          address: "서울 강남역",
          placeHint: "강남",
          dateFrom: "20260518",
          dateTo: "20260518",
        },
      },
      {
        searchFoundItemsByName: vi.fn(async () => ({
          header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
          pagination: { totalCount: 0 },
          items: [],
        })),
        searchFoundItemsByLocation,
      },
    );

    expect(searchFoundItemsByLocation).toHaveBeenCalledWith({
      productName: "에어팟",
      address: "서울 강남역",
      pageNo: 1,
      numOfRows: 20,
    });
  });
});
