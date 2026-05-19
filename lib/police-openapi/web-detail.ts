import { getFoundItemDetailUrl } from "@/lib/police-openapi/mappers";

type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

function normalizeHtmlText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseFoundItemWebStatus(html: string) {
  const text = normalizeHtmlText(html);
  const match = text.match(/유실물상태\s*([^\s]+)/);
  return match?.[1]?.trim() || null;
}

export async function fetchFoundItemWebStatus({
  atcId,
  sequence = "1",
  fetcher = fetch,
}: {
  atcId: string;
  sequence?: string;
  fetcher?: Fetcher;
}) {
  const response = await fetcher(getFoundItemDetailUrl(atcId, sequence), {
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return parseFoundItemWebStatus(await response.text());
}
