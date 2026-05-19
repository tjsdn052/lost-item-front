import { NextResponse } from "next/server";
import { fetchPoliceDetail, generatePoliceGuide } from "@/lib/police-guide";
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

    const detail = await fetchPoliceDetail(
      atcId,
      body.item?.sequence ? String(body.item.sequence) : undefined,
      body.item?.source,
    );
    const guide = await generatePoliceGuide(detail, body.item?.title);

    return NextResponse.json({
      detail,
      guidance: guide.guidance,
      usedFallback: guide.usedFallback,
    });
  } catch {
    return NextResponse.json(
      { message: "경찰청 상세 안내를 가져오지 못했습니다." },
      { status: 500 },
    );
  }
}
