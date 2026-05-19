import { describe, expect, it } from "vitest";
import {
  mergeFoundItemResponses,
  tagFoundItemSource,
} from "@/lib/police-openapi/sources";

describe("police OpenAPI source helpers", () => {
  it("tags response items with their source service", () => {
    const response = tagFoundItemSource(
      {
        header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
        pagination: { totalCount: 1 },
        items: [{ atcId: "P1" }],
      },
      "portal",
    );

    expect(response.items).toEqual([{ atcId: "P1", sourceService: "portal" }]);
  });

  it("merges items and total counts from multiple source responses", () => {
    expect(
      mergeFoundItemResponses([
        {
          header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
          pagination: { totalCount: 2 },
          items: [{ atcId: "A" }],
        },
        {
          header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
          pagination: { totalCount: 3 },
          items: [{ atcId: "B" }],
        },
      ]),
    ).toMatchObject({
      pagination: { totalCount: 5 },
      items: [{ atcId: "A" }, { atcId: "B" }],
    });
  });
});
