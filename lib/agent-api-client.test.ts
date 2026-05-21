import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchPoliceGuideFromAgent,
  searchLostItemsByTextWithAgent,
  searchLostItemsWithAgent,
} from "@/lib/agent-api-client";

describe("agent-api-client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("posts text searches to the external FastAPI agent", async () => {
    vi.stubEnv("LOST_ITEM_AGENT_URL", "http://127.0.0.1:8766");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          items: [],
          total: 0,
          sessionId: "session-1",
          usedFallback: false,
        }),
      ),
    );

    const result = await searchLostItemsByTextWithAgent("검은 지갑", "session-1");

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8766/search/text",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "검은 지갑", sessionId: "session-1" }),
      }),
    );
    expect(result).toMatchObject({ sessionId: "session-1", total: 0 });
  });

  it("forwards multipart searches to the external FastAPI agent", async () => {
    vi.stubEnv("LOST_ITEM_AGENT_URL", "http://127.0.0.1:8766/");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          items: [],
          total: 0,
          usedFallback: false,
        }),
      ),
    );

    await searchLostItemsWithAgent({
      query: "검은 지갑",
      sessionId: "session-1",
      image: null,
    });

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8766/search/submit",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      }),
    );
  });

  it("posts police guide requests to the external FastAPI agent", async () => {
    vi.stubEnv("LOST_ITEM_AGENT_URL", "http://127.0.0.1:8766");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          detail: { atcId: "F1", detailUrl: "https://example.com" },
          guidance: "방문 전 연락하세요.",
          usedFallback: true,
        }),
      ),
    );

    const result = await fetchPoliceGuideFromAgent({
      atcId: "F1",
      item: {
        id: "F1",
        title: "검은 지갑",
        location: "강남지구대",
        discoveredAt: "2026.05.20",
        matchLabel: "매칭률 90%",
        confidence: "high",
      },
    });

    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8766/police-guide",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    expect(result).toMatchObject({ guidance: "방문 전 연락하세요." });
  });
});
