import { describe, expect, it } from "vitest";
import { filterOpenFoundItems, isClosedFoundItem } from "@/lib/police-openapi/status";

describe("police found item status helpers", () => {
  it("detects closed found items from csteSteNm", () => {
    expect(isClosedFoundItem({ atcId: "F1", csteSteNm: "종결" })).toBe(true);
    expect(isClosedFoundItem({ atcId: "F1", csteSteNm: "유실물상태종결" })).toBe(true);
    expect(isClosedFoundItem({ atcId: "F1", csteSteNm: "종결처리" })).toBe(true);
    expect(isClosedFoundItem({ atcId: "F1", csteSteNm: " 반환 " })).toBe(true);
    expect(isClosedFoundItem({ atcId: "F2", csteSteNm: "보관중" })).toBe(false);
  });

  it("filters closed found items", () => {
    expect(
      filterOpenFoundItems([
        { atcId: "open", csteSteNm: "보관중" },
        { atcId: "closed", csteSteNm: "종결" },
      ]),
    ).toEqual([{ atcId: "open", csteSteNm: "보관중" }]);
  });
});
