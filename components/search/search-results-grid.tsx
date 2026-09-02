"use client";

import { useRef, useState } from "react";
import { PoliceGuideModal } from "@/components/search/police-guide-modal";
import { SearchResultCard } from "@/components/search/search-result-card";
import type { SearchResult } from "@/data/search-results";
import type { PoliceGuideResponse } from "@/types/police-guide";

type SearchResultsGridProps = {
  items: SearchResult[];
};

export function SearchResultsGrid({ items }: SearchResultsGridProps) {
  const requestIdRef = useRef(0);
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const [guide, setGuide] = useState<PoliceGuideResponse | null>(null);
  const [isLoadingGuide, setIsLoadingGuide] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);

  async function handleSelectItem(item: SearchResult) {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    setSelectedItem(item);
    setGuide(null);
    setGuideError(null);
    setIsLoadingGuide(true);

    try {
      const response = await fetch("/map/api/police-guide", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          atcId: String(item.id),
          item,
        }),
      });

      if (!response.ok) {
        throw new Error("경찰청 상세 안내를 가져오지 못했습니다.");
      }

      const data = (await response.json()) as PoliceGuideResponse;
      if (requestIdRef.current === requestId) {
        setGuide(data);
      }
    } catch {
      if (requestIdRef.current === requestId) {
        setGuideError(
          "상세 안내를 바로 가져오지 못했습니다. 잠시 후 다시 시도해 주세요.",
        );
      }
    } finally {
      if (requestIdRef.current === requestId) {
        setIsLoadingGuide(false);
      }
    }
  }

  if (items.length === 0) {
    return (
      <section className="mx-auto max-w-7xl px-8">
        <div className="rounded-[1.5rem] border border-outline-variant/15 bg-surface-container-lowest p-10 text-center shadow-[0_18px_42px_rgba(25,28,30,0.06)]">
          <p className="font-headline text-2xl font-bold text-on-surface">
            아직 일치하는 습득물 후보가 없습니다
          </p>
          <p className="mt-3 text-sm leading-6 text-on-surface-variant">
            검색어를 조금 더 구체적으로 바꾸거나 다른 단서를 추가해서 다시
            찾아보세요.
          </p>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="mx-auto grid max-w-7xl grid-cols-1 gap-8 px-8 md:grid-cols-2 lg:grid-cols-4">
        {items.map((item) => (
          <SearchResultCard
            key={item.id}
            item={item}
            onSelect={() => {
              void handleSelectItem(item);
            }}
          />
        ))}
      </section>
      <PoliceGuideModal
        isOpen={selectedItem !== null}
        item={selectedItem}
        detail={guide?.detail}
        guidance={guide?.guidance}
        isLoading={isLoadingGuide}
        error={guideError}
        onClose={() => {
          requestIdRef.current += 1;
          setSelectedItem(null);
          setGuide(null);
          setGuideError(null);
          setIsLoadingGuide(false);
        }}
      />
    </>
  );
}
