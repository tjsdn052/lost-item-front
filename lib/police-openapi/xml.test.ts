import { describe, expect, it } from "vitest";
import { parsePoliceXmlResponse } from "@/lib/police-openapi/xml";

describe("parsePoliceXmlResponse", () => {
  it("parses a list response with multiple items", () => {
    const result = parsePoliceXmlResponse(`
      <response>
        <header>
          <resultCode>00</resultCode>
          <resultMsg>NORMAL SERVICE.</resultMsg>
        </header>
        <body>
          <items>
            <item>
              <atcId>F2023092100000404</atcId>
              <fdSn>1</fdSn>
              <fdPrdtNm>카드지갑</fdPrdtNm>
            </item>
            <item>
              <atcId>F2023092000003095</atcId>
              <fdSn>2</fdSn>
              <fdPrdtNm>boss지갑</fdPrdtNm>
            </item>
          </items>
          <numOfRows>10</numOfRows>
          <pageNo>1</pageNo>
          <totalCount>559</totalCount>
        </body>
      </response>
    `);

    expect(result.header).toEqual({
      resultCode: "00",
      resultMsg: "NORMAL SERVICE.",
    });
    expect(result.items).toEqual([
      {
        atcId: "F2023092100000404",
        fdSn: "1",
        fdPrdtNm: "카드지갑",
      },
      {
        atcId: "F2023092000003095",
        fdSn: "2",
        fdPrdtNm: "boss지갑",
      },
    ]);
    expect(result.pagination).toEqual({
      numOfRows: 10,
      pageNo: 1,
      totalCount: 559,
    });
  });

  it("parses a detail response with a single item", () => {
    const result = parsePoliceXmlResponse(`
      <response>
        <header>
          <resultCode>00</resultCode>
          <resultMsg>NORMAL SERVICE.</resultMsg>
        </header>
        <body>
          <item>
            <atcId>F2018113000002322</atcId>
            <fdSn>1</fdSn>
            <csteSteNm>보관중</csteSteNm>
            <tel>02-944-4347</tel>
          </item>
        </body>
      </response>
    `);

    expect(result.items).toEqual([
      {
        atcId: "F2018113000002322",
        fdSn: "1",
        csteSteNm: "보관중",
        tel: "02-944-4347",
      },
    ]);
  });

  it("preserves an API error header without items", () => {
    const result = parsePoliceXmlResponse(`
      <response>
        <header>
          <resultCode>30</resultCode>
          <resultMsg>SERVICE KEY IS NOT REGISTERED ERROR.</resultMsg>
        </header>
        <body />
      </response>
    `);

    expect(result.header).toEqual({
      resultCode: "30",
      resultMsg: "SERVICE KEY IS NOT REGISTERED ERROR.",
    });
    expect(result.items).toEqual([]);
  });
});
