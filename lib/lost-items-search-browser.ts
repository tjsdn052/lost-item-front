import type { LostItemsSearchResult } from "@/lib/lost-items-search-shared";

type BrowserSearchInput = {
  query?: string;
  sessionId?: string;
  image?: File | null;
};

export type BrowserSearchProgress = {
  node: string;
  label: string;
};

type BrowserSearchOptions = {
  onProgress?: (progress: BrowserSearchProgress) => void;
  signal?: AbortSignal;
};

export type BrowserSearchResponse = LostItemsSearchResult & {
  token?: string;
};

function parseSseMessage(rawMessage: string) {
  const lines = rawMessage.split(/\r?\n/);
  const event = lines
    .find((line) => line.startsWith("event:"))
    ?.slice("event:".length)
    .trim();
  const data = lines
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice("data:".length).trim())
    .join("\n");

  if (!event || !data) {
    return null;
  }

  return {
    event,
    data: JSON.parse(data) as unknown,
  };
}

function processSseChunk(
  chunk: string,
  buffer: string,
  onMessage: (event: string, data: unknown) => void,
) {
  let nextBuffer = buffer + chunk;
  const messages = nextBuffer.split(/\r?\n\r?\n/);
  nextBuffer = messages.pop() ?? "";

  messages.forEach((message) => {
    const parsed = parseSseMessage(message);

    if (parsed) {
      onMessage(parsed.event, parsed.data);
    }
  });

  return nextBuffer;
}

async function requestSearchJson(formData: FormData) {
  const response = await fetch("/map/api/search/submit", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Search request failed with status ${response.status}`);
  }

  return (await response.json()) as BrowserSearchResponse;
}

async function readSearchStream(
  response: Response,
  onProgress?: (progress: BrowserSearchProgress) => void,
) {
  if (!response.body) {
    throw new Error("Search stream response body is empty.");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: BrowserSearchResponse | null = null;

  const handleMessage = (event: string, data: unknown) => {
    if (event === "step") {
      const progress = data as Partial<BrowserSearchProgress>;
      if (progress.node && progress.label) {
        onProgress?.({
          node: progress.node,
          label: progress.label,
        });
      }
      return;
    }

    if (event === "result") {
      const payload = data as { result?: BrowserSearchResponse } & BrowserSearchResponse;
      result = payload.result ?? payload;
    }
  };

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer = processSseChunk(
      decoder.decode(value, { stream: true }),
      buffer,
      handleMessage,
    );
  }

  buffer = processSseChunk(decoder.decode(), buffer, handleMessage);
  if (buffer.trim()) {
    const parsed = parseSseMessage(buffer);
    if (parsed) {
      handleMessage(parsed.event, parsed.data);
    }
  }

  if (!result) {
    throw new Error("Search stream finished without a result event.");
  }

  return result;
}

export async function searchLostItemsDirect(
  input: BrowserSearchInput,
  options: BrowserSearchOptions = {},
): Promise<BrowserSearchResponse> {
  const query = input.query?.trim();
  const sessionId = input.sessionId?.trim() || undefined;
  const image = input.image ?? null;

  if (!query && !image) {
    return {
      items: [],
      total: 0,
      usedFallback: false,
    };
  }

  const formData = new FormData();

  if (query) {
    formData.set("query", query);
  }

  if (sessionId) {
    formData.set("sessionId", sessionId);
  }

  if (image) {
    formData.set("file", image);
  }

  const response = await fetch("/map/api/search/stream", {
    method: "POST",
    body: formData,
    signal: options.signal,
  });

  if (
    !response.ok ||
    !response.headers.get("Content-Type")?.startsWith("text/event-stream")
  ) {
    return requestSearchJson(formData);
  }

  return readSearchStream(response, options.onProgress);
}
