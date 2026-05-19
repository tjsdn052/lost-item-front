import type { SearchMetadata } from "@/lib/lost-items-search-shared";

type SearchQueryMetadataChipsProps = {
  metadata?: SearchMetadata | null;
};

function formatDateHint(value: string) {
  const compact = value.replace(/\D/g, "");

  if (/^\d{8}$/.test(compact)) {
    return `${compact.slice(0, 4)}.${compact.slice(4, 6)}.${compact.slice(6, 8)}`;
  }

  return value;
}

export function SearchQueryMetadataChips({
  metadata,
}: SearchQueryMetadataChipsProps) {
  const chips = [
    metadata?.item_type ? `물건 ${metadata.item_type}` : null,
    metadata?.color ? `색상 ${metadata.color}` : null,
    metadata?.location_hint ? `장소 ${metadata.location_hint}` : null,
    metadata?.date_hint ? `날짜 ${formatDateHint(metadata.date_hint)}` : null,
  ].filter(Boolean) as string[];

  if (chips.length === 0) {
    return null;
  }

  return (
    <section className="mx-auto mb-8 max-w-7xl px-8">
      <div className="flex flex-wrap gap-2">
        {chips.map((chip) => (
          <span
            key={chip}
            className="inline-flex h-9 items-center rounded-full border border-primary/10 bg-primary-fixed/35 px-4 text-sm font-semibold text-primary"
          >
            {chip}
          </span>
        ))}
      </div>
    </section>
  );
}
