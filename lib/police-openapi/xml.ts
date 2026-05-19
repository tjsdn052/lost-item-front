import { XMLParser } from "fast-xml-parser";
import type { PoliceXmlItem, PoliceXmlResponse } from "@/lib/police-openapi/types";

const parser = new XMLParser({
  ignoreAttributes: true,
  parseTagValue: false,
  trimValues: true,
});

function asString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown) {
  const rawValue = asString(value);
  const parsed = Number(rawValue);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return value as Record<string, unknown>;
}

function asItems(value: unknown): PoliceXmlItem[] {
  if (!value) {
    return [];
  }

  const rawItems = Array.isArray(value) ? value : [value];

  return rawItems.map((rawItem) => {
    const record = asRecord(rawItem);
    const item: PoliceXmlItem = {};

    for (const [key, rawValue] of Object.entries(record)) {
      const value = asString(rawValue);

      if (value) {
        item[key] = value;
      }
    }

    return item;
  });
}

function getItemNode(body: Record<string, unknown>) {
  const items = asRecord(body.items);

  return items.item ?? body.item;
}

export function parsePoliceXmlResponse(xml: string): PoliceXmlResponse {
  const parsed = parser.parse(xml) as unknown;
  const response = asRecord(asRecord(parsed).response);
  const header = asRecord(response.header);
  const body = asRecord(response.body);

  return {
    header: {
      resultCode: asString(header.resultCode),
      resultMsg: asString(header.resultMsg),
    },
    items: asItems(getItemNode(body)),
    pagination: {
      numOfRows: asNumber(body.numOfRows),
      pageNo: asNumber(body.pageNo),
      totalCount: asNumber(body.totalCount),
    },
  };
}
