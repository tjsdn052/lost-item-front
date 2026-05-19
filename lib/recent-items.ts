import "server-only";

import { createPoliceOpenApiClientFromEnv } from "@/lib/police-openapi/client";
import { mapFoundItemsToRecentItems } from "@/lib/police-openapi/mappers";

const DEFAULT_RECENT_ITEMS_LIMIT = 30;

export type RecentItem = {
  id: string;
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

  if (!client) {
    return [];
  }

  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(endDate.getDate() - 30);

  try {
    const response = await client.searchFoundItemsByCategoryAreaPeriod({
      startDate: formatApiDate(startDate),
      endDate: formatApiDate(endDate),
      pageNo: 1,
      numOfRows: limit,
    });
    return mapFoundItemsToRecentItems(response.items);
  } catch {
    return [];
  }
}
