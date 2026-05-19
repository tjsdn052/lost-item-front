import type { PoliceXmlItem } from "@/lib/police-openapi/types";

export type SearchSlots = {
  itemName?: string;
  color?: string;
  brand?: string;
  placeHint?: string;
  dateFrom?: string;
  dateTo?: string;
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
      tool: "searchFoundItemsByCategoryAreaPeriod";
      args: {
        startDate?: string;
        endDate?: string;
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
