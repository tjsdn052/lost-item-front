import type { PoliceXmlResponse } from "@/lib/police-openapi/types";

export type FoundItemSource = "police" | "portal";

export function tagFoundItemSource(
  response: PoliceXmlResponse,
  source: FoundItemSource,
): PoliceXmlResponse {
  return {
    ...response,
    items: response.items.map((item) => ({
      ...item,
      sourceService: source,
    })),
  };
}

export function mergeFoundItemResponses(
  responses: PoliceXmlResponse[],
): PoliceXmlResponse {
  return {
    header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
    pagination: {
      totalCount: responses.reduce(
        (total, response) => total + (response.pagination.totalCount ?? 0),
        0,
      ),
    },
    items: responses.flatMap((response) => response.items),
  };
}
