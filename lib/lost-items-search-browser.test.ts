import { afterEach, describe, expect, it, vi } from "vitest";
import { searchLostItemsDirect } from "@/lib/lost-items-search-browser";

function streamFromText(text: string) {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

describe("lost-items-search-browser", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("reports streamed agent steps before returning the final result", async () => {
    const onProgress = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          streamFromText(
            [
              'event: step\ndata: {"node":"normalize_input","label":"입력 내용을 정리하고 있어요"}',
              'event: result\ndata: {"items":[],"total":0,"usedFallback":false}',
              "",
            ].join("\n\n"),
          ),
          {
            headers: { "Content-Type": "text/event-stream" },
          },
        ),
      ),
    );

    const result = await searchLostItemsDirect(
      { query: "검은 지갑" },
      { onProgress },
    );

    expect(fetch).toHaveBeenCalledWith(
      "/api/search/stream",
      expect.objectContaining({
        method: "POST",
        body: expect.any(FormData),
      }),
    );
    expect(onProgress).toHaveBeenCalledWith({
      node: "normalize_input",
      label: "입력 내용을 정리하고 있어요",
    });
    expect(result).toMatchObject({ total: 0, usedFallback: false });
  });

  it("passes an abort signal to the streamed search request", async () => {
    const controller = new AbortController();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          streamFromText('event: result\ndata: {"items":[],"total":0,"usedFallback":false}\n\n'),
          {
            headers: { "Content-Type": "text/event-stream" },
          },
        ),
      ),
    );

    await searchLostItemsDirect(
      { query: "검은 지갑" },
      { signal: controller.signal },
    );

    expect(fetch).toHaveBeenCalledWith(
      "/api/search/stream",
      expect.objectContaining({
        signal: controller.signal,
      }),
    );
  });
});
