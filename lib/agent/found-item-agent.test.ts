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
});
