import { NextResponse } from "next/server";
import { fetchPoliceGuideFromAgent } from "@/lib/agent-api-client";
import type { SearchResult } from "@/data/search-results";

type PoliceGuideRequest = {
  atcId?: string;
  item?: SearchResult;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as PoliceGuideRequest;
    const atcId = body.atcId?.trim();

    if (!atcId) {
      return NextResponse.json(
        { message: "atcId가 필요합니다." },
        { status: 400 },
      );
    }

    const guide = await fetchPoliceGuideFromAgent(body);

    return NextResponse.json(guide);
  } catch {
    return NextResponse.json(
      { message: "경찰청 상세 안내를 가져오지 못했습니다." },
      { status: 500 },
    );
  }
}
