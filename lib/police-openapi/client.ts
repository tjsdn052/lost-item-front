import { parsePoliceXmlResponse } from "@/lib/police-openapi/xml";
import type { PoliceXmlResponse } from "@/lib/police-openapi/types";

const DEFAULT_BASE_URL =
  "https://apis.data.go.kr/1320000/LosfundInfoInqireService";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

type ClientOptions = {
  serviceKey: string;
  baseUrl?: string;
  fetcher?: Fetcher;
};

type PaginationInput = {
  pageNo?: number;
  numOfRows?: number;
};

export type SearchFoundItemsByNameInput = PaginationInput & {
  productName?: string;
  custodyPlace?: string;
};

export type SearchFoundItemsByCategoryAreaPeriodInput = PaginationInput & {
  category1?: string;
  category2?: string;
  colorCode?: string;
  startDate?: string;
  endDate?: string;
  locationCode?: string;
};

export type SearchFoundItemsByLocationInput = PaginationInput & {
  productName?: string;
  address?: string;
};

export type GetFoundItemDetailInput = {
  atcId: string;
  sequence: string;
};

export class PoliceOpenApiError extends Error {
  constructor(
    public readonly resultCode: string,
    public readonly resultMsg: string,
  ) {
    super(resultMsg || `Police OpenAPI error: ${resultCode}`);
    this.name = "PoliceOpenApiError";
  }
}

function appendIfPresent(
  params: URLSearchParams,
  key: string,
  value: string | number | undefined,
) {
  if (value === undefined || value === "") {
    return;
  }

  params.set(key, String(value));
}

function createUrl(
  baseUrl: string,
  path: string,
  serviceKey: string,
  paramsInput: Record<string, string | number | undefined>,
) {
  const url = new URL(`${baseUrl.replace(/\/$/, "")}/${path}`);
  url.searchParams.set("serviceKey", serviceKey);

  for (const [key, value] of Object.entries(paramsInput)) {
    appendIfPresent(url.searchParams, key, value);
  }

  return url.toString();
}

function ensureNormalResponse(response: PoliceXmlResponse) {
  if (response.header.resultCode && response.header.resultCode !== "00") {
    throw new PoliceOpenApiError(
      response.header.resultCode,
      response.header.resultMsg,
    );
  }
}

export function createPoliceOpenApiClient({
  serviceKey,
  baseUrl = DEFAULT_BASE_URL,
  fetcher = fetch,
}: ClientOptions) {
  async function request(
    path: string,
    paramsInput: Record<string, string | number | undefined>,
  ) {
    const url = createUrl(baseUrl, path, serviceKey, paramsInput);
    const response = await fetcher(url, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Police OpenAPI HTTP error: ${response.status}`);
    }

    const parsed = parsePoliceXmlResponse(await response.text());
    ensureNormalResponse(parsed);
    return parsed;
  }

  return {
    searchFoundItemsByName(input: SearchFoundItemsByNameInput) {
      return request("getLosfundInfoAccTpNmCstdyPlace", {
        PRDT_NM: input.productName,
        DEP_PLACE: input.custodyPlace,
        pageNo: input.pageNo ?? 1,
        numOfRows: input.numOfRows ?? 10,
      });
    },
    searchFoundItemsByCategoryAreaPeriod(
      input: SearchFoundItemsByCategoryAreaPeriodInput,
    ) {
      return request("getLosfundInfoAccToClAreaPd", {
        PRDT_CL_CD_01: input.category1,
        PRDT_CL_CD_02: input.category2,
        FD_COL_CD: input.colorCode,
        START_YMD: input.startDate,
        END_YMD: input.endDate,
        N_FD_LCT_CD: input.locationCode,
        pageNo: input.pageNo ?? 1,
        numOfRows: input.numOfRows ?? 10,
      });
    },
    searchFoundItemsByLocation(input: SearchFoundItemsByLocationInput) {
      return request("getLosfundInfoAccToLc", {
        PRDT_NM: input.productName,
        ADDR: input.address,
        pageNo: input.pageNo ?? 1,
        numOfRows: input.numOfRows ?? 10,
      });
    },
    getFoundItemDetail(input: GetFoundItemDetailInput) {
      return request("getLosfundDetailInfo", {
        ATC_ID: input.atcId,
        FD_SN: input.sequence,
      });
    },
  };
}

export function createPoliceOpenApiClientFromEnv() {
  const serviceKey = process.env.PUBLIC_DATA_API_KEY?.trim();

  if (!serviceKey) {
    return null;
  }

  return createPoliceOpenApiClient({ serviceKey });
}
