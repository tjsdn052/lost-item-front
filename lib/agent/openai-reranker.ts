import type { RankedFoundItem, SearchSlots } from "@/lib/agent/state";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

type RerankInput = {
  query: string;
  slots: SearchSlots;
  items: RankedFoundItem[];
};

type OpenAIResponse = {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
};

type RerankResponse = {
  rankings?: Array<{
    candidateId?: string;
    score?: number;
    reason?: string;
  }>;
};

function extractOutputText(response: OpenAIResponse) {
  return (
    response.output
      ?.filter((item) => item.type === "message")
      .flatMap((item) => item.content ?? [])
      .filter((item) => item.type === "output_text")
      .map((item) => item.text?.trim())
      .find(Boolean) ?? ""
  );
}

function candidateId(ranked: RankedFoundItem) {
  return `${ranked.item.atcId}:${ranked.item.fdSn ?? "1"}`;
}

function clampScore(score: unknown) {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return 0;
  }

  return Math.max(0, Math.min(1, score));
}

function summarizeCandidate(ranked: RankedFoundItem) {
  const item = ranked.item;

  return {
    candidateId: candidateId(ranked),
    source: item.sourceService ?? "police",
    productName: item.fdPrdtNm ?? null,
    subject: item.fdSbjt ?? null,
    foundDate: item.fdYmd ?? null,
    foundPlace: item.fdPlace ?? null,
    custodyPlace: item.depPlace ?? null,
    address: item.addr ?? null,
    category: item.prdtClNm ?? null,
    color: item.clrNm ?? null,
    deterministicScore: ranked.score,
    deterministicMatch: ranked.matchedVia,
  };
}

function buildRerankedItems(
  inputItems: RankedFoundItem[],
  parsed: RerankResponse,
) {
  const itemById = new Map(inputItems.map((item) => [candidateId(item), item]));
  const seen = new Set<string>();
  const rankedByModel = (parsed.rankings ?? [])
    .map((ranking) => ({
      candidateId: ranking.candidateId,
      llmScore: clampScore(ranking.score),
    }))
    .filter((ranking): ranking is { candidateId: string; llmScore: number } => {
      if (!ranking.candidateId || seen.has(ranking.candidateId)) {
        return false;
      }

      seen.add(ranking.candidateId);
      return itemById.has(ranking.candidateId);
    })
    .sort((left, right) => right.llmScore - left.llmScore)
    .map((ranking) => {
      const ranked = itemById.get(ranking.candidateId)!;
      const score = Number(
        Math.min(0.95, ranked.score * 0.55 + ranking.llmScore * 0.45).toFixed(2),
      );

      return {
        ...ranked,
        score,
        matchedVia: ranked.matchedVia.includes("LLM")
          ? ranked.matchedVia
          : `${ranked.matchedVia}/LLM`,
      };
    });

  if (rankedByModel.length === 0) {
    return null;
  }

  const rankedIds = new Set(rankedByModel.map(candidateId));
  const remaining = inputItems.filter((item) => !rankedIds.has(candidateId(item)));

  return [...rankedByModel, ...remaining];
}

export async function rerankFoundItemsWithOpenAI(
  input: RerankInput,
  apiKey = process.env.OPENAI_API_KEY?.trim(),
): Promise<RankedFoundItem[] | null> {
  if (!apiKey || !input.query.trim() || input.items.length < 2) {
    return null;
  }

  try {
    const response = await fetch(OPENAI_RESPONSES_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.5",
        reasoning: { effort: "low" },
        max_output_tokens: 600,
        instructions:
          "너는 한국어 분실물 검색 결과 재정렬기다. 사용자 설명과 후보의 실제 필드만 비교한다. 후보에 없는 사실을 만들지 않는다. 반드시 제공된 candidateId만 반환하고, 가장 맞는 후보부터 score 0~1로 정렬한다.",
        input: JSON.stringify({
          query: input.query,
          slots: input.slots,
          candidates: input.items.map(summarizeCandidate),
        }),
        text: {
          format: {
            type: "json_schema",
            name: "found_item_rerank",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                rankings: {
                  type: "array",
                  items: {
                    type: "object",
                    additionalProperties: false,
                    properties: {
                      candidateId: { type: "string" },
                      score: { type: "number" },
                      reason: { type: "string" },
                    },
                    required: ["candidateId", "score", "reason"],
                  },
                },
              },
              required: ["rankings"],
            },
          },
        },
      }),
    });

    if (!response.ok) {
      return null;
    }

    const text = extractOutputText((await response.json()) as OpenAIResponse);

    if (!text) {
      return null;
    }

    return buildRerankedItems(input.items, JSON.parse(text) as RerankResponse);
  } catch {
    return null;
  }
}
