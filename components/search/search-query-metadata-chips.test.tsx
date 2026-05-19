import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SearchQueryMetadataChips } from "@/components/search/search-query-metadata-chips";

describe("SearchQueryMetadataChips", () => {
  it("shows extracted item, color, location, and date hints", () => {
    render(
      <SearchQueryMetadataChips
        metadata={{
          item_type: "지갑",
          color: "검정",
          location_hint: "서울 강남역",
          date_hint: "20260518",
        }}
      />,
    );

    expect(screen.getByText("물건 지갑")).not.toBeNull();
    expect(screen.getByText("색상 검정")).not.toBeNull();
    expect(screen.getByText("장소 서울 강남역")).not.toBeNull();
    expect(screen.getByText("날짜 2026.05.18")).not.toBeNull();
  });
});
