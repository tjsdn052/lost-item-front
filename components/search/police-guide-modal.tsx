"use client";

import Image from "next/image";
import { useEffect } from "react";
import type { SearchResult } from "@/data/search-results";
import { getFoundItemDetailUrl } from "@/lib/police-openapi/mappers";
import type { PoliceGuideDetail } from "@/types/police-guide";
import { CloseIcon, LocationIcon, WalletIcon } from "@/components/ui/icons";

type PoliceGuideModalProps = {
  isOpen: boolean;
  item: SearchResult | null;
  detail?: PoliceGuideDetail | null;
  guidance?: string | null;
  isLoading: boolean;
  error?: string | null;
  onClose: () => void;
};

function MiniResultCard({ item }: { item: SearchResult }) {
  return (
    <div className="flex w-full max-w-xs items-center gap-3 rounded-[1.2rem] bg-white/14 p-3">
      <div className="relative h-[4.5rem] w-[4.5rem] shrink-0 overflow-hidden rounded-2xl bg-white/12">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.title}
            fill
            sizes="72px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-white/60">
            <WalletIcon className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-extrabold text-white">{item.title}</p>
        <p className="mt-1 flex items-center gap-1 text-xs text-white/70">
          <LocationIcon className="h-3.5 w-3.5" />
          <span className="truncate">{item.location}</span>
        </p>
        <p className="mt-1 text-xs text-white/70">{item.discoveredAt}</p>
      </div>
    </div>
  );
}

function SourceFacts({ detail }: { detail: PoliceGuideDetail }) {
  const facts = [
    detail.storagePlace
      ? { label: "보관장소", value: detail.storagePlace }
      : null,
    detail.storagePhone
      ? { label: "연락처", value: detail.storagePhone }
      : null,
    detail.managementNumber
      ? { label: "관리번호", value: detail.managementNumber }
      : null,
    detail.foundDateTime
      ? { label: "습득일시", value: detail.foundDateTime }
      : null,
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  if (facts.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 grid gap-2 sm:grid-cols-2">
      {facts.map((fact) => (
        <div
          key={`${fact.label}-${fact.value}`}
          className="rounded-2xl border border-primary/10 bg-white px-3 py-2"
        >
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-primary/70">
            {fact.label}
          </p>
          <p className="mt-1 text-sm font-semibold text-on-surface">
            {fact.value}
          </p>
        </div>
      ))}
    </div>
  );
}

export function PoliceGuideModal({
  isOpen,
  item,
  detail,
  guidance,
  isLoading,
  error,
  onClose,
}: PoliceGuideModalProps) {
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen || !item) {
    return null;
  }

  const assistantText = error
    ? error
    : guidance ||
      "경찰청 상세 페이지를 확인하고 있어요. 연락처와 방문 방법을 정리해서 바로 안내드릴게요.";
  const detailUrl =
    detail?.detailUrl ?? getFoundItemDetailUrl(String(item.id), item.sequence);

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/42 px-4 py-6 backdrop-blur-md"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="relative w-full max-w-4xl overflow-hidden rounded-[2rem] border border-white/60 bg-[linear-gradient(180deg,rgba(220,225,255,0.6)_0%,rgba(255,255,255,0.98)_16%,rgba(255,255,255,1)_100%)] shadow-[0_32px_120px_rgba(0,35,111,0.24)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-primary/10 px-6 py-5">
          <div>
            <p className="font-headline text-2xl font-extrabold tracking-tight text-primary">
              수령 안내 채팅
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">
              경찰청 상세 페이지를 바탕으로 연락과 방문 순서를 정리했습니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-white text-on-surface-variant shadow-[0_12px_28px_rgba(25,28,30,0.08)] transition-colors hover:bg-slate-50"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[78vh] overflow-y-auto px-6 py-6">
          <div className="flex justify-end">
            <div className="max-w-md rounded-[1.6rem] rounded-br-sm bg-primary px-4 py-4 text-on-primary shadow-[0_22px_44px_rgba(0,35,111,0.22)]">
              <span className="mb-3 block text-[11px] font-bold uppercase tracking-[0.16em] text-white/70">
                You
              </span>
              <p className="mb-3 text-sm font-semibold leading-6 text-white/88">
                이 카드가 제 물건 같은데, 어디로 연락하고 어떻게 가면 되는지
                알려줘.
              </p>
              <MiniResultCard item={item} />
            </div>
          </div>

          <div className="mt-6 flex justify-start">
            <div className="max-w-2xl rounded-[1.6rem] rounded-bl-sm border border-slate-200/80 bg-slate-50 px-5 py-4 text-on-surface shadow-[0_22px_44px_rgba(25,28,30,0.1)]">
              <span className="mb-3 block text-[11px] font-bold uppercase tracking-[0.16em] text-primary/70">
                AI
              </span>

              {isLoading ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                    <span className="relative flex h-2.5 w-2.5">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                    </span>
                    경찰청 보관 정보와 연락처를 정리하고 있어요
                  </div>
                  <div className="h-3 w-full rounded-full bg-slate-200" />
                  <div className="h-3 w-[92%] rounded-full bg-slate-200" />
                  <div className="h-3 w-[78%] rounded-full bg-slate-200" />
                </div>
              ) : (
                <>
                  <p className="whitespace-pre-line text-sm leading-7 text-on-surface">
                    {assistantText}
                  </p>
                  {detail ? <SourceFacts detail={detail} /> : null}
                  <div className="mt-5">
                    <a
                      href={detailUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-white transition-transform hover:brightness-105 active:scale-[0.98]"
                    >
                      경찰청 상세 페이지로 이동
                    </a>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
