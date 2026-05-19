import { describe, expect, it, vi } from "vitest";
import {
  createPoliceOpenApiClient,
  PoliceOpenApiError,
} from "@/lib/police-openapi/client";

function createXmlResponse(xml: string, ok = true) {
  return Promise.resolve(
    new Response(xml, {
      status: ok ? 200 : 500,
      headers: { "content-type": "application/xml" },
    }),
  );
}

describe("createPoliceOpenApiClient", () => {
  it("calls found-item name search with service key and pagination", async () => {
    const fetcher = vi.fn(() =>
      createXmlResponse(`
        <response>
          <header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header>
          <body><items /></body>
        </response>
      `),
    );
    const client = createPoliceOpenApiClient({
      serviceKey: "encoded-key",
      fetcher,
    });

    await client.searchFoundItemsByName({
      productName: "지갑",
      custodyPlace: "서울종로경찰서",
      pageNo: 2,
      numOfRows: 20,
    });

    const requestedUrl = new URL(fetcher.mock.calls[0][0] as string);
    expect(requestedUrl.pathname).toBe(
      "/1320000/LosfundInfoInqireService/getLosfundInfoAccTpNmCstdyPlace",
    );
    expect(requestedUrl.searchParams.get("serviceKey")).toBe("encoded-key");
    expect(requestedUrl.searchParams.get("PRDT_NM")).toBe("지갑");
    expect(requestedUrl.searchParams.get("DEP_PLACE")).toBe("서울종로경찰서");
    expect(requestedUrl.searchParams.get("pageNo")).toBe("2");
    expect(requestedUrl.searchParams.get("numOfRows")).toBe("20");
  });

  it("calls detail search with ATC_ID and FD_SN", async () => {
    const fetcher = vi.fn(() =>
      createXmlResponse(`
        <response>
          <header><resultCode>00</resultCode><resultMsg>NORMAL SERVICE.</resultMsg></header>
          <body><item><atcId>F1</atcId><fdSn>3</fdSn></item></body>
        </response>
      `),
    );
    const client = createPoliceOpenApiClient({
      serviceKey: "encoded-key",
      fetcher,
    });

    await client.getFoundItemDetail({
      atcId: "F1",
      sequence: "3",
    });

    const requestedUrl = new URL(fetcher.mock.calls[0][0] as string);
    expect(requestedUrl.pathname).toBe(
      "/1320000/LosfundInfoInqireService/getLosfundDetailInfo",
    );
    expect(requestedUrl.searchParams.get("ATC_ID")).toBe("F1");
    expect(requestedUrl.searchParams.get("FD_SN")).toBe("3");
  });

  it("throws a typed error for non-normal API result codes", async () => {
    const client = createPoliceOpenApiClient({
      serviceKey: "bad-key",
      fetcher: vi.fn(() =>
        createXmlResponse(`
          <response>
            <header>
              <resultCode>30</resultCode>
              <resultMsg>SERVICE KEY IS NOT REGISTERED ERROR.</resultMsg>
            </header>
            <body />
          </response>
        `),
      ),
    });

    await expect(
      client.searchFoundItemsByName({ productName: "지갑" }),
    ).rejects.toEqual(
      new PoliceOpenApiError(
        "30",
        "SERVICE KEY IS NOT REGISTERED ERROR.",
      ),
    );
  });
});
