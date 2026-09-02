import { ChevronDownIcon, LocationIcon, SearchIcon } from "@/components/ui/icons";

type SearchToolbarProps = {
  query: string;
  sessionId?: string | null;
};

type FilterChip = {
  label: string;
  icon?: "chevron" | "location";
};

const filterChips: FilterChip[] = [
  { label: "Best Match", icon: "chevron" },
  { label: "Latest" },
  { label: "Location", icon: "location" },
];

export function SearchToolbar({ query, sessionId }: SearchToolbarProps) {
  return (
    <section className="mx-auto mb-12 max-w-7xl px-8">
      <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
        <form action="/map/search" className="w-full md:max-w-xl">
          {sessionId ? <input type="hidden" name="sid" value={sessionId} /> : null}
          <label
            htmlFor="search-query"
            className="ml-1 block text-sm font-medium text-slate-500"
          >
            Current Search
          </label>
          <div className="relative mt-2">
            <SearchIcon className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-secondary" />
            <input
              id="search-query"
              name="q"
              type="text"
              defaultValue={query}
              className="h-14 w-full rounded-xl border-none bg-surface-container-lowest pl-12 pr-4 font-medium text-on-surface shadow-[0_8px_24px_rgba(25,28,30,0.06)] outline-none ring-0 transition-all focus:ring-2 focus:ring-primary/40"
            />
          </div>
        </form>

        <div className="flex flex-wrap gap-2">
          {filterChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              className="inline-flex items-center gap-2 rounded-full bg-surface-container-highest px-4 py-2 text-sm font-medium text-on-surface-variant transition-colors hover:bg-outline-variant"
            >
              {chip.icon === "location" ? (
                <LocationIcon className="h-4 w-4" />
              ) : null}
              {chip.label}
              {chip.icon === "chevron" ? (
                <ChevronDownIcon className="h-4 w-4" />
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
