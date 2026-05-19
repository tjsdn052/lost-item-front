import type { PoliceXmlItem } from "@/lib/police-openapi/types";

export function isClosedFoundItem(item: PoliceXmlItem) {
  const status = item.csteSteNm?.replace(/\s/g, "") ?? "";
  return /종결|반환/.test(status);
}

export function filterOpenFoundItems(items: PoliceXmlItem[]) {
  return items.filter((item) => !isClosedFoundItem(item));
}
