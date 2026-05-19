import Image from "next/image";
import type { SearchResult } from "@/data/search-results";
import { getFoundItemDetailUrl } from "@/lib/police-openapi/mappers";
import { BoltIcon, LocationIcon, WalletIcon } from "@/components/ui/icons";

type SearchResultCardProps = {
  item: SearchResult;
  onSelect: () => void;
};

export function SearchResultCard({ item, onSelect }: SearchResultCardProps) {
  const isHighConfidence = item.confidence === "high";
  const detailUrl = getFoundItemDetailUrl(String(item.id), item.sequence);

  return (
    <article className="rounded-xl">
      <a
        href={detailUrl}
        target="_blank"
        rel="noreferrer"
        className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
      >
        <div className="relative aspect-[4/3] overflow-hidden rounded-[0.9rem]">
          {item.imageUrl ? (
            <Image
              src={item.imageUrl}
              alt={item.title}
              fill
              sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center bg-primary-fixed text-primary/20">
              <WalletIcon className="h-16 w-16" />
            </div>
          )}

          <div className="absolute left-4 top-4">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-extrabold shadow-sm ${
                isHighConfidence
                  ? "bg-secondary-fixed text-on-secondary-fixed"
                  : "bg-surface-container-highest text-slate-500"
              }`}
            >
              {isHighConfidence ? <BoltIcon className="h-3.5 w-3.5" /> : null}
              {item.matchLabel}
            </span>
          </div>
        </div>
      </a>

      <div className="py-6">
        <h3 className="font-headline text-xl font-bold text-on-surface">
          {item.title}
        </h3>
        <p className="mt-2 flex items-center gap-1 text-sm text-slate-500">
          <LocationIcon className="h-4 w-4" />
          {item.location} · {item.discoveredAt}
        </p>
        {item.pickupPlace ? (
          <p className="mt-2 text-sm text-slate-500">
            습득장소 · {item.pickupPlace}
          </p>
        ) : null}
        <button
          type="button"
          onClick={onSelect}
          className="mt-6 block w-full cursor-pointer rounded-lg bg-[linear-gradient(135deg,#00236f_0%,#1e3a8a_100%)] py-3 text-center font-medium text-white transition-transform active:scale-95"
        >
          이거 내 거 같아요
        </button>
      </div>
    </article>
  );
}
