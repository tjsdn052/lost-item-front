import { Document } from "@langchain/core/documents";

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

export function retrievePickupGuideContext(query: string, limit = 3) {
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
