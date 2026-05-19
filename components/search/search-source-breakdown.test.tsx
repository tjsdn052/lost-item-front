import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SearchSourceBreakdown } from "@/components/search/search-source-breakdown";

describe("SearchSourceBreakdown", () => {
  it("shows source counts for raw, filtered, and final search stages", () => {
    render(
      <SearchSourceBreakdown
        breakdown={{
          raw: { police: 3, portal: 2 },
          afterStatusFilter: { police: 2, portal: 1 },
          final: { police: 2, portal: 0 },
        }}
      />,
    );

    expect(screen.getByText("API 수집")).not.toBeNull();
    expect(screen.getByText("경찰청 3건")).not.toBeNull();
    expect(screen.getByText("포털기관 2건")).not.toBeNull();
    expect(screen.getByText("상태 필터 후")).not.toBeNull();
    expect(screen.getByText("포털기관 1건")).not.toBeNull();
    expect(screen.getByText("최종 노출")).not.toBeNull();
    expect(screen.getByText("포털기관 0건")).not.toBeNull();
  });
});
