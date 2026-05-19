import "server-only";

import {
  createPoliceOpenApiClientFromEnv,
  createPortalFoundOpenApiClientFromEnv,
} from "@/lib/police-openapi/client";
import { mapFoundItemsToRecentItems } from "@/lib/police-openapi/mappers";
import {
  mergeFoundItemResponses,
  tagFoundItemSource,
} from "@/lib/police-openapi/sources";
import { filterOpenFoundItems } from "@/lib/police-openapi/status";

const DEFAULT_RECENT_ITEMS_LIMIT = 30;

export type RecentItem = {
  id: string;
  source?: "police" | "portal";
  sequence?: string;
  name: string;
  location: string;
  imageUrl?: string;
  badgeLabel: string;
  discoveredAt: string;
  pickupPlace?: string;
};

function formatApiDate(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

export async function getRecentItems(
  limit = DEFAULT_RECENT_ITEMS_LIMIT,
): Promise<RecentItem[]> {
  const client = createPoliceOpenApiClientFromEnv();
  const portalClient = createPortalFoundOpenApiClientFromEnv();

  if (!client && !portalClient) {
    return [];
  }

  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 30);

  try {
    const request = {
      startDate: formatApiDate(startDate),
      endDate: formatApiDate(endDate),
      pageNo: 1,
      numOfRows: limit,
    };
    const responses = await Promise.allSettled([
      client
        ? client
            .searchFoundItemsByCategoryAreaPeriod(request)
            .then((response) => tagFoundItemSource(response, "police"))
        : Promise.reject(new Error("police client missing")),
      portalClient
        ? portalClient
            .searchFoundItemsByCategoryAreaPeriod(request)
            .then((response) => tagFoundItemSource(response, "portal"))
        : Promise.reject(new Error("portal client missing")),
    ]);
    const response = mergeFoundItemResponses(
      responses
        .filter((result) => result.status === "fulfilled")
        .map((result) => result.value),
    );
    return mapFoundItemsToRecentItems(filterOpenFoundItems(response.items));
  } catch {
    return [];
  }
}
