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

async function fileToDataUrl(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const mimeType = file.type || "image/jpeg";
  return `data:${mimeType};base64,${buffer.toString("base64")}`;
}

export async function extractSearchSlotsFromImageWithOpenAI(
  image: File | null | undefined,
  apiKey = process.env.OPENAI_API_KEY?.trim(),
): Promise<Partial<SearchSlots> | null> {
  if (!image || !apiKey) {
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
          "이미지 속 물건에서 경찰청 습득물 검색에 필요한 단서만 추출한다. 확실하지 않은 값은 null로 둔다. 한국어 일반명사를 우선한다.",
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: "이 이미지에서 물건 종류, 색상, 브랜드 후보를 JSON으로 추출해 주세요.",
              },
              {
                type: "input_image",
                image_url: await fileToDataUrl(image),
              },
            ],
          },
        ],
        text: {
          format: {
            type: "json_schema",
            name: "found_item_image_slots",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                itemName: { type: ["string", "null"] },
                color: { type: ["string", "null"] },
                brand: { type: ["string", "null"] },
              },
              required: ["itemName", "color", "brand"],
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
    };
  } catch {
    return null;
  }
}
