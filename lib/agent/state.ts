import type { PoliceXmlItem } from "@/lib/police-openapi/types";

export type SearchSlots = {
  itemName?: string;
  color?: string;
  brand?: string;
  placeHint?: string;
  address?: string;
  dateFrom?: string;
  dateTo?: string;
  category1?: string;
  category2?: string;
  colorCode?: string;
  locationCode?: string;
};

export type FoundItemSearchToolCall =
  | {
      tool: "searchFoundItemsByName";
      args: {
        productName: string;
        custodyPlace?: string;
        pageNo: number;
        numOfRows: number;
      };
    }
  | {
      tool: "searchFoundItemsByLocation";
      args: {
        productName?: string;
        address: string;
        pageNo: number;
        numOfRows: number;
      };
    }
  | {
      tool: "searchFoundItemsByCategoryAreaPeriod";
      args: {
        category1?: string;
        category2?: string;
        colorCode?: string;
        startDate?: string;
        endDate?: string;
        locationCode?: string;
        pageNo: number;
        numOfRows: number;
      };
    };

export type FoundItemSearchPlan = {
  slots: SearchSlots;
  followUpQuestion: string | null;
  toolCalls: FoundItemSearchToolCall[];
};

export type RankedFoundItem = {
  item: PoliceXmlItem;
  score: number;
  matchedVia: string;
};
