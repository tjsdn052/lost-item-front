import "server-only";

import { Document } from "@langchain/core/documents";
import { createClient } from "@supabase/supabase-js";

const GUIDE_DOCUMENTS = [
  new Document({
    pageContent:
      "습득물 수령 전에는 보관 기관에 먼저 연락해 현재 보관 여부, 방문 가능 시간, 담당 부서를 확인해야 한다.",
    metadata: { id: "call-before-visit" },
  }),
  new Document({
    pageContent:
      "습득물을 찾으러 갈 때는 본인 확인이 가능한 신분증을 지참하고, 물건의 색상, 브랜드, 구성품, 분실 장소와 날짜를 설명할 준비를 해야 한다.",
    metadata: { id: "identity-proof" },
  }),
  new Document({
    pageContent:
      "관리번호와 습득순번이 있으면 기관 담당자가 물건을 더 빠르게 확인할 수 있으므로 전화나 방문 시 함께 전달한다.",
    metadata: { id: "management-number" },
  }),
];

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/[^0-9a-z가-힣]+/i)
    .filter((token) => token.length >= 2);
}

async function retrieveSupabasePickupGuideContext(query: string, limit: number) {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey || !query.trim()) {
    return [];
  }

  try {
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
      },
    });
    const { data, error } = await supabase.rpc("match_pickup_guide_documents", {
      query_text: query,
      match_count: limit,
    });

    if (error || !Array.isArray(data)) {
      return [];
    }

    return data
      .map((row) => {
        if (typeof row === "string") {
          return row;
        }

        if (row && typeof row === "object") {
          const record = row as Record<string, unknown>;
          const content = record.content ?? record.page_content;
          return typeof content === "string" ? content : null;
        }

        return null;
      })
      .filter((content): content is string => Boolean(content))
      .slice(0, limit);
  } catch {
    return [];
  }
}

function retrieveLocalPickupGuideContext(query: string, limit: number) {
  const queryTokens = new Set(tokenize(query));

  return GUIDE_DOCUMENTS.map((document) => {
    const score = tokenize(document.pageContent).reduce(
      (currentScore, token) => currentScore + (queryTokens.has(token) ? 1 : 0),
      0,
    );

    return { document, score };
  })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map(({ document }) => document.pageContent);
}

export async function retrievePickupGuideContext(query: string, limit = 3) {
  const supabaseContext = await retrieveSupabasePickupGuideContext(query, limit);

  if (supabaseContext.length > 0) {
    return supabaseContext;
  }

  return retrieveLocalPickupGuideContext(query, limit);
}
