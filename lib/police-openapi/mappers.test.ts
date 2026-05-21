import { describe, expect, it } from "vitest";
import {
  mapFoundItemToSearchResult,
  mapFoundItemsToRecentItems,
} from "@/lib/police-openapi/mappers";

describe("police OpenAPI mappers", () => {
  it("maps a found item list record to a search result card", () => {
    expect(
      mapFoundItemToSearchResult(
        {
          atcId: "F2023092000003095",
          fdSn: "2",
          fdPrdtNm: "boss지갑",
          fdSbjt: "boss지갑(블랙(검정)색)을 습득하여 보관하고 있습니다.",
          fdYmd: "2023-09-20",
          depPlace: "서울종로경찰서",
          fdPlace: "홍대입구역",
          prdtClNm: "지갑 > 남성용 지갑",
          fdFilePathImg:
            "https://www.lost112.go.kr/lostnfs/images/uploadImg/20230920/r_wallet.jpg",
        },
        0.91,
        "이름/색상/장소",
      ),
    ).toEqual({
      id: "F2023092000003095",
      source: "police",
      sequence: "2",
      title: "boss지갑",
      location: "서울종로경찰서",
      pickupPlace: "홍대입구역",
      discoveredAt: "2023.09.20",
      matchLabel: "매칭률 91%",
      confidence: "high",
      imageUrl:
        "https://www.lost112.go.kr/lostnfs/images/uploadImg/20230920/r_wallet.jpg",
    });
  });

  it("omits no-image placeholders from search result cards", () => {
    const result = mapFoundItemToSearchResult(
      {
        atcId: "F2018113000002322",
        fdSn: "1",
        fdPrdtNm: "여성용가방",
        fdYmd: "2018-11-30",
        depPlace: "서울강북경찰서",
        fdFilePathImg: "https://www.lost112.go.kr/lostnfs/images/sub/img04_no_img.gif",
      },
      0.7,
      "이름",
    );

    expect(result.imageUrl).toBeUndefined();
    expect(result.matchLabel).toBe("유사 후보");
    expect(result.confidence).toBe("medium");
  });

  it("maps recent found items into carousel items", () => {
    expect(
      mapFoundItemsToRecentItems([
        {
          atcId: "F2023092100000404",
          fdSn: "1",
          fdPrdtNm: "카드지갑",
          fdYmd: "2023-09-21",
          depPlace: "서울종로경찰서",
          fdPlace: "인사동",
        },
      ]),
    ).toEqual([
      {
        id: "F2023092100000404",
        source: "police",
        sequence: "1",
        name: "카드지갑",
        location: "서울종로경찰서",
        badgeLabel: "2023.09.21",
        discoveredAt: "2023.09.21",
        pickupPlace: "인사동",
      },
    ]);
  });
});
