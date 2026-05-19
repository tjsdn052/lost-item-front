import { describe, expect, it, vi } from "vitest";
import {
  fetchFoundItemWebStatus,
  parseFoundItemWebStatus,
} from "@/lib/police-openapi/web-detail";

describe("lost112 web detail status", () => {
  it("parses the visible lost item status from the detail page html", () => {
    expect(
      parseFoundItemWebStatus(`
        <html><body>
          <dt>유실물상태</dt><dd>종결</dd>
          <dt>보관장소연락처</dt>
        </body></html>
      `),
    ).toBe("종결");
  });

  it("fetches status from the lost112 detail page", async () => {
    const fetcher = vi.fn(async () =>
      new Response("<span>유실물상태</span><strong>보관중</strong>", {
        status: 200,
      }),
    );

    await expect(
      fetchFoundItemWebStatus({
        atcId: "F1",
        sequence: "2",
        fetcher,
      }),
    ).resolves.toBe("보관중");

    const requestedUrl = new URL(fetcher.mock.calls[0][0] as string);
    expect(requestedUrl.searchParams.get("ATC_ID")).toBe("F1");
    expect(requestedUrl.searchParams.get("FD_SN")).toBe("2");
  });
});
