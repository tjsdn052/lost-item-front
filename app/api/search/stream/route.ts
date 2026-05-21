import { NextResponse } from "next/server";
import { streamSearchLostItemsWithAgent } from "@/lib/agent-api-client";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const query = formData.get("query");
    const sessionId = formData.get("sessionId");
    const file = formData.get("file");

    const response = await streamSearchLostItemsWithAgent(
      {
        query: typeof query === "string" ? query : undefined,
        sessionId: typeof sessionId === "string" ? sessionId : undefined,
        image: file instanceof File ? file : null,
      },
      {
        signal: request.signal,
      },
    );

    return new Response(response.body, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": "text/event-stream; charset=utf-8",
      },
    });
  } catch {
    return NextResponse.json(
      { message: "검색 스트림을 처리하지 못했습니다." },
      { status: 500 },
    );
  }
}
