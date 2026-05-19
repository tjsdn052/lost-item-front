import type { SearchSlots } from "@/lib/agent/state";

const OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses";

type OpenAIResponse = {
  output?: Array<{
    type?: string;
    content?: Array<{
      type?: string;
      text?: string;
    }>;
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

function cleanSlot(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export async function extractSearchSlotsWithOpenAI(
  query: string,
  apiKey = process.env.OPENAI_API_KEY?.trim(),
): Promise<Partial<SearchSlots> | null> {
  if (!apiKey || !query.trim()) {
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
        max_output_tokens: 180,
        instructions:
          "한국어 분실물 설명에서 경찰청 습득물 검색에 필요한 단서만 추출한다. 없는 정보는 null로 둔다. 사용자가 잃어버린 물건을 찾는 상황이므로 검색 대상은 습득물이다.",
        input: query,
        text: {
          format: {
            type: "json_schema",
            name: "found_item_search_slots",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                itemName: { type: ["string", "null"] },
                color: { type: ["string", "null"] },
                brand: { type: ["string", "null"] },
                placeHint: { type: ["string", "null"] },
                dateFrom: { type: ["string", "null"] },
                dateTo: { type: ["string", "null"] },
              },
              required: [
                "itemName",
                "color",
                "brand",
                "placeHint",
                "dateFrom",
                "dateTo",
              ],
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

    const parsed = JSON.parse(text) as Record<string, unknown>;

    return {
      itemName: cleanSlot(parsed.itemName),
      color: cleanSlot(parsed.color),
      brand: cleanSlot(parsed.brand),
      placeHint: cleanSlot(parsed.placeHint),
      dateFrom: cleanSlot(parsed.dateFrom),
      dateTo: cleanSlot(parsed.dateTo),
    };
  } catch {
    return null;
  }
}
