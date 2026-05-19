import "server-only";

import { retrievePickupGuideContext } from "@/lib/agent/guide-rag";
import {
  createPoliceOpenApiClientFromEnv,
  createPortalFoundOpenApiClientFromEnv,
} from "@/lib/police-openapi/client";
import { mapFoundDetailToPoliceGuideDetail } from "@/lib/police-openapi/mappers";
import { tagFoundItemSource, type FoundItemSource } from "@/lib/police-openapi/sources";
import type { PoliceGuideDetail } from "@/types/police-guide";

const OPENAI_API_URL = "https://api.openai.com/v1/responses";

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
  const parts =
    response.output
      ?.filter((item) => item.type === "message")
      .flatMap((item) => item.content ?? [])
      .filter((item) => item.type === "output_text")
      .map((item) => item.text?.trim())
      .filter((item): item is string => Boolean(item)) ?? [];

  return parts.join("\n").trim();
}

export async function fetchPoliceDetail(
  atcId: string,
  sequence = "1",
  source: FoundItemSource = "police",
): Promise<PoliceGuideDetail> {
  const client =
    source === "portal"
      ? createPortalFoundOpenApiClientFromEnv()
      : createPoliceOpenApiClientFromEnv();

  if (!client) {
    throw new Error("PUBLIC_DATA_API_KEY is required.");
  }

  const response = tagFoundItemSource(
    await client.getFoundItemDetail({ atcId, sequence }),
    source,
  );
  const [detail] = response.items;

  if (!detail) {
    throw new Error("Police detail response is empty.");
  }

  return mapFoundDetailToPoliceGuideDetail(detail);
}

function buildFallbackGuidance(detail: PoliceGuideDetail) {
  const place = detail.storagePlace || detail.receiptPlace || "보관기관";
  const phone = detail.storagePhone
    ? `${place}에 ${detail.storagePhone}로 먼저 연락해서 아직 보관 중인지와 방문 가능한 시간, 수령 절차를 먼저 확인해 보세요.`
    : "연락처가 페이지에 바로 보이지 않으면 경찰민원24 상세 페이지에서 보관기관 정보를 다시 확인해 보세요.";
  const notice =
    detail.visitNotice ||
    "방문 전에는 담당자와 먼저 통화하고, 본인 확인 서류를 챙겨 가는 편이 안전합니다.";
  const management = detail.managementNumber
    ? `전화하거나 방문할 때 관리번호 ${detail.managementNumber}를 함께 말하면 확인이 훨씬 빨라집니다.`
    : "전화하거나 방문할 때는 물건 특징과 습득일을 함께 설명하면 확인이 더 빨라집니다.";
  const identity =
    "찾으러 갈 때는 신분증 같은 본인 확인 서류를 꼭 챙기고, 분실물 특징도 함께 설명할 수 있게 준비해 두세요.";

  return [
    `${place}에서 보관 중인 것으로 보입니다.`,
    phone,
    notice,
    management,
    identity,
  ].join(" ");
}

export async function generatePoliceGuide(
  detail: PoliceGuideDetail,
  itemTitle?: string,
) {
  const apiKey = process.env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    return {
      guidance: buildFallbackGuidance(detail),
      usedFallback: true,
    };
  }

  const input = [
    "수령 안내 참고 지식:",
    ...(await retrievePickupGuideContext(
      [
        itemTitle,
        detail.itemName,
        detail.storagePlace,
        detail.managementNumber,
        detail.detailDescription,
      ]
        .filter(Boolean)
        .join(" "),
    )).map((context) => `- ${context}`),
    "",
    itemTitle ? `현재 사용자가 선택한 카드 제목: ${itemTitle}` : null,
    detail.itemName ? `경찰청 등록 물품명: ${detail.itemName}` : null,
    detail.foundDateTime ? `습득일시: ${detail.foundDateTime}` : null,
    detail.foundPlace ? `습득 장소: ${detail.foundPlace}` : null,
    detail.category ? `물품 분류: ${detail.category}` : null,
    detail.status ? `유실물 상태: ${detail.status}` : null,
    detail.detailDescription ? `상세 설명: ${detail.detailDescription}` : null,
    detail.receiptPlace ? `접수장소: ${detail.receiptPlace}` : null,
    detail.storagePlace ? `보관장소: ${detail.storagePlace}` : null,
    detail.storagePhone ? `보관장소 연락처: ${detail.storagePhone}` : null,
    detail.managementNumber ? `관리번호: ${detail.managementNumber}` : null,
    detail.visitNotice ? `방문 전 안내: ${detail.visitNotice}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-5.5",
        reasoning: {
          effort: "low",
        },
        max_output_tokens: 220,
        instructions:
          "당신은 한국 분실물 수령 절차를 안내하는 도우미다. 주어진 경찰청 상세 내용만 바탕으로 답하고 추측하지 말라. 한국어로만 답하라. 딱딱한 목록형이나 제목형 구성을 쓰지 말고, 사람에게 바로 설명하듯 자연스럽게 이어지는 말투의 2~3개 짧은 문단으로 써라. 어디로 연락하면 되는지, 방문 전에 무엇을 확인하면 되는지, 갈 때 무엇을 챙기면 좋은지, 관리번호나 장소를 어떻게 말하면 되는지를 자연스럽게 녹여 설명하라. 불릿, 숫자 목록, '다음 정보를 바탕으로' 같은 문구는 쓰지 마라.",
        input,
        text: {
          format: {
            type: "text",
          },
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI request failed: ${response.status}`);
    }

    const data = (await response.json()) as OpenAIResponse;
    const guidance = extractOutputText(data);

    if (!guidance) {
      throw new Error("OpenAI response text is empty");
    }

    return {
      guidance,
      usedFallback: false,
    };
  } catch {
    return {
      guidance: buildFallbackGuidance(detail),
      usedFallback: true,
    };
  }
}
