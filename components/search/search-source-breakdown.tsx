import type { SearchSourceBreakdown } from "@/lib/lost-items-search-shared";

type SearchSourceBreakdownProps = {
  breakdown?: SearchSourceBreakdown | null;
};

const STAGES: Array<{
  key: keyof SearchSourceBreakdown;
  label: string;
}> = [
  { key: "raw", label: "API 수집" },
  { key: "afterStatusFilter", label: "상태 필터 후" },
  { key: "final", label: "최종 노출" },
];

function formatCount(label: string, count: number) {
  return `${label} ${count}건`;
}

export function SearchSourceBreakdown({
  breakdown,
}: SearchSourceBreakdownProps) {
  if (!breakdown) {
    return null;
  }

  return (
    <section className="mx-auto mb-8 max-w-7xl px-8">
      <div className="grid gap-3 md:grid-cols-3">
        {STAGES.map((stage) => {
          const counts = breakdown[stage.key];

          return (
            <div
              key={stage.key}
              className="rounded-[1rem] border border-outline-variant/15 bg-surface-container-lowest px-4 py-3 shadow-[0_12px_28px_rgba(25,28,30,0.05)]"
            >
              <p className="text-xs font-semibold text-on-surface-variant">
                {stage.label}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span className="inline-flex h-8 items-center rounded-full bg-primary-fixed/35 px-3 text-xs font-semibold text-primary">
                  {formatCount("경찰청", counts.police)}
                </span>
                <span className="inline-flex h-8 items-center rounded-full bg-secondary-container px-3 text-xs font-semibold text-on-secondary-container">
                  {formatCount("포털기관", counts.portal)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
