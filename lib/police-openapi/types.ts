export type PoliceApiHeader = {
  resultCode: string;
  resultMsg: string;
};

export type PoliceXmlItem = Record<string, string>;

export type PoliceApiPagination = {
  numOfRows?: number;
  pageNo?: number;
  totalCount?: number;
};

export type PoliceXmlResponse = {
  header: PoliceApiHeader;
  items: PoliceXmlItem[];
  pagination: PoliceApiPagination;
};
