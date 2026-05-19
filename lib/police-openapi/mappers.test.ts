import { describe, expect, it } from "vitest";
import {
  mapFoundDetailToPoliceGuideDetail,
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

  it("maps a found item detail record to pickup guide detail facts", () => {
    expect(
      mapFoundDetailToPoliceGuideDetail({
        atcId: "F2018113000002322",
        fdSn: "1",
        csteSteNm: "보관중",
        depPlace: "서울강북경찰서",
        fdPlace: "노상",
        fdPrdtNm: "여성용가방",
        fdYmd: "2018-11-30",
        fdHor: "24",
        prdtClNm: "가방 > 여성용가방",
        orgNm: "서울강북경찰서",
        tel: "02-944-4347",
        uniq: "본인 증명 서류를 지참하시어 방문하시기 바랍니다.",
      }),
    ).toEqual({
      atcId: "F2018113000002322",
      sequence: "1",
      detailUrl:
        "https://www.lost112.go.kr/find/findDetail.do?ATC_ID=F2018113000002322&FD_SN=1",
      itemName: "여성용가방",
      foundDateTime: "2018-11-30 24시",
      foundPlace: "노상",
      category: "가방 > 여성용가방",
      status: "보관중",
      detailDescription: "본인 증명 서류를 지참하시어 방문하시기 바랍니다.",
      receiptPlace: "서울강북경찰서",
      storagePlace: "서울강북경찰서",
      storagePhone: "02-944-4347",
      managementNumber: "F2018113000002322-1",
    });
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
