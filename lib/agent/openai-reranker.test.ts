import { afterEach, describe, expect, it, vi } from "vitest";
import { rerankFoundItemsWithOpenAI } from "@/lib/agent/openai-reranker";

describe("rerankFoundItemsWithOpenAI", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when no OpenAI API key is configured", async () => {
    const result = await rerankFoundItemsWithOpenAI(
      {
        query: "검은 지갑",
        slots: { itemName: "지갑", color: "검정" },
        items: [
          {
            item: {
              atcId: "F1",
              fdSn: "1",
              fdPrdtNm: "지갑",
              fdSbjt: "검정 지갑",
            },
            score: 0.8,
            matchedVia: "이름/색상",
          },
        ],
      },
      "",
    );

    expect(result).toBeNull();
  });

  it("reranks only known candidate ids from the OpenAI response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            output: [
              {
                type: "message",
                content: [
                  {
                    type: "output_text",
                    text: JSON.stringify({
                      rankings: [
                        {
                          candidateId: "SEMANTIC:1",
                          score: 0.95,
                          reason: "장소와 물건 설명이 가장 가까움",
                        },
                        {
                          candidateId: "UNKNOWN:1",
                          score: 1,
                          reason: "없는 후보",
                        },
                      ],
                    }),
                  },
                ],
              },
            ],
          }),
          { status: 200 },
        ),
      ),
    );

    const result = await rerankFoundItemsWithOpenAI(
      {
        query: "서울 강남역에서 잃어버린 검은 지갑",
        slots: { itemName: "지갑", color: "검정", address: "서울 강남역" },
        items: [
          {
            item: {
              atcId: "KEYWORD",
              fdSn: "1",
              fdPrdtNm: "검정 지갑",
              fdSbjt: "검정 지갑",
              fdPlace: "종로",
            },
            score: 0.8,
            matchedVia: "이름/색상",
          },
          {
            item: {
              atcId: "SEMANTIC",
              fdSn: "1",
              fdPrdtNm: "지갑",
              fdSbjt: "카드와 신분증이 들어있는 반지갑",
              fdPlace: "서울 강남역 11번 출구",
            },
            score: 0.65,
            matchedVia: "이름",
          },
        ],
      },
      "test-key",
    );

    expect(result?.map((ranked) => ranked.item.atcId)).toEqual([
      "SEMANTIC",
      "KEYWORD",
    ]);
    expect(result?.[0].matchedVia).toContain("LLM");
  });
});
