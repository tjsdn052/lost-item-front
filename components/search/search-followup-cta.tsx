import Link from "next/link";
import { TrackIcon } from "@/components/ui/icons";

type SearchFollowUpCtaProps = {
  query: string;
  sessionId?: string | null;
};

export function SearchFollowUpCta({
  query,
  sessionId,
}: SearchFollowUpCtaProps) {
  const href = sessionId
    ? `/search?q=${encodeURIComponent(query)}&sid=${encodeURIComponent(sessionId)}`
    : `/search?q=${encodeURIComponent(query)}`;

  return (
    <section id="track-search" className="mx-auto mt-24 max-w-3xl px-8 text-center">
      <div className="rounded-[1.75rem] border border-outline-variant/15 bg-surface-container-lowest p-12 shadow-[0_32px_64px_-16px_rgba(25,28,30,0.1)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
          <TrackIcon className="h-8 w-8" />
        </div>
        <h2 className="mt-6 font-headline text-3xl font-bold tracking-tight text-on-surface">
          찾으시는 물건이 없나요?
        </h2>
        <p className="mt-4 text-lg leading-relaxed text-slate-500">
          걱정 마세요. AI 에이전트가 등록한 정보를 바탕으로
          <br />
          전국의 습득물 데이터에서 계속 탐색합니다.
        </p>
        <Link
          href={href}
          className="mx-auto mt-10 inline-flex items-center gap-3 rounded-xl bg-secondary-container px-8 py-4 text-lg font-extrabold text-on-secondary-container transition-all hover:brightness-95 active:scale-95"
        >
          <TrackIcon className="h-5 w-5" />
          계속 찾아달라고 하기 (탐색 시작)
        </Link>
      </div>
    </section>
  );
}
