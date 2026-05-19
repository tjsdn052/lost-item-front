"use client";

import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { ItemCard } from "@/components/home/item-card";
import { PoliceGuideModal } from "@/components/search/police-guide-modal";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/ui/icons";
import type { SearchResult } from "@/data/search-results";
import type { RecentItem } from "@/lib/recent-items";
import type { PoliceGuideResponse } from "@/types/police-guide";

type RecentItemsCarouselProps = {
  items: RecentItem[];
};

const SCROLL_AMOUNT = 220;
const AUTO_SCROLL_PIXELS_PER_MS = 0.035;
const INTERACTION_PAUSE_MS = 2200;

export function RecentItemsCarousel({ items }: RecentItemsCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const requestIdRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);
  const [selectedItem, setSelectedItem] = useState<SearchResult | null>(null);
  const [guide, setGuide] = useState<PoliceGuideResponse | null>(null);
  const [isLoadingGuide, setIsLoadingGuide] = useState(false);
  const [guideError, setGuideError] = useState<string | null>(null);
  const isHoveringRef = useRef(false);
  const pauseUntilRef = useRef(0);
  const dragStateRef = useRef({
    pointerId: -1,
    startX: 0,
    scrollLeft: 0,
  });
  const tripledItems = [...items, ...items, ...items];

  function wrapScrollPosition(scroller: HTMLDivElement) {
    const setWidth = scroller.scrollWidth / 3;

    if (scroller.scrollLeft <= setWidth * 0.5) {
      scroller.scrollLeft += setWidth;
    } else if (scroller.scrollLeft >= setWidth * 1.5) {
      scroller.scrollLeft -= setWidth;
    }
  }

  useEffect(() => {
    const scroller = scrollerRef.current;

    if (!scroller || items.length === 0) {
      return;
    }

    const setWidth = scroller.scrollWidth / 3;
    scroller.scrollLeft = setWidth;

    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    if (mediaQuery.matches) {
      return;
    }

    let frameId = 0;
    let lastTimestamp = performance.now();

    const step = (timestamp: number) => {
      const currentScroller = scrollerRef.current;

      if (!currentScroller) {
        return;
      }

      const elapsed = timestamp - lastTimestamp;
      lastTimestamp = timestamp;

      if (
        !isHoveringRef.current &&
        dragStateRef.current.pointerId === -1 &&
        timestamp >= pauseUntilRef.current
      ) {
        currentScroller.scrollLeft += elapsed * AUTO_SCROLL_PIXELS_PER_MS;
        wrapScrollPosition(currentScroller);
      }

      frameId = window.requestAnimationFrame(step);
    };

    frameId = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [items]);

  function pauseAutoScroll() {
    pauseUntilRef.current = performance.now() + INTERACTION_PAUSE_MS;
  }

  function scrollByAmount(direction: "left" | "right") {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    pauseAutoScroll();
    scroller.scrollBy({
      left: direction === "left" ? -SCROLL_AMOUNT : SCROLL_AMOUNT,
      behavior: "smooth",
    });
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    const scroller = scrollerRef.current;

    if (!scroller) {
      return;
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      scrollLeft: scroller.scrollLeft,
    };

    pauseAutoScroll();
    scroller.setPointerCapture(event.pointerId);
    setIsDragging(true);
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const scroller = scrollerRef.current;

    if (!scroller || !isDragging || dragStateRef.current.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - dragStateRef.current.startX;
    scroller.scrollLeft = dragStateRef.current.scrollLeft - deltaX;
    wrapScrollPosition(scroller);
  }

  function stopDragging(event?: ReactPointerEvent<HTMLDivElement>) {
    const scroller = scrollerRef.current;

    if (scroller && event && scroller.hasPointerCapture(event.pointerId)) {
      scroller.releasePointerCapture(event.pointerId);
    }

    dragStateRef.current.pointerId = -1;
    pauseAutoScroll();
    setIsDragging(false);
  }

  function toSearchResult(item: RecentItem): SearchResult {
    return {
      id: item.id,
      source: item.source,
      sequence: item.sequence,
      title: item.name,
      location: item.location,
      pickupPlace: item.pickupPlace,
      discoveredAt: item.discoveredAt,
      matchLabel: "최근 등록",
      confidence: "medium",
      imageUrl: item.imageUrl,
    };
  }

  async function handleSelectItem(item: RecentItem) {
    const requestId = requestIdRef.current + 1;
    const searchItem = toSearchResult(item);
    requestIdRef.current = requestId;
    setSelectedItem(searchItem);
    setGuide(null);
    setGuideError(null);
    setIsLoadingGuide(true);

    try {
      const response = await fetch("/api/police-guide", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          atcId: item.id,
          item: searchItem,
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

  return (
    <>
      <div className="mt-10">
        <div className="mb-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => scrollByAmount("left")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/30 bg-surface-container-lowest text-primary shadow-[0_12px_24px_rgba(0,35,111,0.08)] transition-colors hover:bg-primary hover:text-on-primary"
            aria-label="최근 등록 분실물 왼쪽으로 이동"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollByAmount("right")}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-outline-variant/30 bg-surface-container-lowest text-primary shadow-[0_12px_24px_rgba(0,35,111,0.08)] transition-colors hover:bg-primary hover:text-on-primary"
            aria-label="최근 등록 분실물 오른쪽으로 이동"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        </div>

        <div
          ref={scrollerRef}
          className={`no-scrollbar flex gap-3 overflow-x-auto overflow-y-visible px-1 pt-2 pb-10 ${
            isDragging ? "cursor-grabbing select-none" : "cursor-grab"
          }`}
          style={{ touchAction: "pan-y" }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerCancel={stopDragging}
          onMouseEnter={() => {
            isHoveringRef.current = true;
          }}
          onMouseLeave={() => {
            isHoveringRef.current = false;
          }}
          onScroll={(event) => {
            wrapScrollPosition(event.currentTarget);
          }}
          onPointerLeave={(event) => {
            if (isDragging) {
              stopDragging(event);
            }
          }}
        >
          {tripledItems.map((item, index) => (
            <ItemCard
              key={`${item.id}-${index}`}
              item={item}
              onSelect={() => {
                void handleSelectItem(item);
              }}
            />
          ))}
        </div>
      </div>
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
