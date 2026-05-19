import type { RefObject } from "react";
import { ChevronDownIcon, SparklesIcon } from "@/components/ui/icons";

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  text: string;
};

type SearchChatPanelProps = {
  isOpen: boolean;
  messages: ChatMessage[];
  draftAnswer: string;
  currentPrompt?: {
    title: string;
    description: string;
    suggestions: string[];
  };
  summaryQuery?: string;
  isNavigating: boolean;
  firstUserBubbleRef?: RefObject<HTMLDivElement | null>;
  hideFirstUserBubble?: boolean;
  onDraftAnswerChange: (value: string) => void;
  onSubmitAnswer: () => void;
  onSearchNow: () => void;
  onClose: () => void;
};

export function SearchChatPanel({
  isOpen,
  messages,
  draftAnswer,
  currentPrompt,
  summaryQuery,
  isNavigating,
  firstUserBubbleRef,
  hideFirstUserBubble = false,
  onDraftAnswerChange,
  onSubmitAnswer,
  onSearchNow,
  onClose,
}: SearchChatPanelProps) {
  return (
    <div
      className={`overflow-hidden transition-all duration-500 ease-out ${
        isOpen ? "max-h-[44rem] opacity-100" : "pointer-events-none max-h-0 opacity-0"
      }`}
      aria-hidden={!isOpen}
    >
      <div className="border-t border-primary/10 px-4 pb-4 pt-4 md:px-5 md:pb-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-[0_16px_24px_rgba(0,35,111,0.18)]">
              <SparklesIcon className="h-5 w-5" />
            </div>
            <div className="text-left">
              <p className="font-headline text-lg font-extrabold tracking-tight text-primary">
                유사한 습득물 후보를 찾기 위해 추가 정보가 필요해요
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="inline-flex cursor-pointer items-center gap-1 rounded-full bg-white/80 px-3 py-1.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-white"
          >
            접기
            <ChevronDownIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="no-scrollbar mt-5 flex max-h-[20rem] flex-col gap-3 overflow-y-auto pr-1">
          {messages.map((message, index) => {
            const isAssistant = message.role === "assistant";
            const isFirstUserBubble = index === 0 && !isAssistant;
            const shouldAnimateBubble = !(isFirstUserBubble && hideFirstUserBubble);

            return (
              <div
                key={message.id}
                className={`${shouldAnimateBubble ? "animate-rise-in" : ""} flex ${
                  isAssistant ? "justify-start" : "justify-end"
                }`}
                style={
                  shouldAnimateBubble
                    ? { animationDelay: `${index * 80}ms` }
                    : undefined
                }
              >
                <div
                  ref={isFirstUserBubble ? firstUserBubbleRef : undefined}
                  className={`max-w-[88%] rounded-[1.25rem] px-4 py-3 text-left shadow-[0_10px_24px_rgba(25,28,30,0.06)] ${
                    isAssistant
                      ? "rounded-bl-sm border border-slate-200/80 bg-slate-50 text-on-surface shadow-[0_18px_34px_rgba(25,28,30,0.08)]"
                      : "rounded-br-sm bg-primary text-on-primary shadow-[0_18px_34px_rgba(0,35,111,0.18)]"
                  } ${
                    isFirstUserBubble && hideFirstUserBubble ? "invisible" : ""
                  }`}
                >
                  <span
                    className={`mb-1 block text-[11px] font-bold uppercase tracking-[0.16em] ${
                      isAssistant ? "text-primary/70" : "text-white/70"
                    }`}
                  >
                    {isAssistant ? "찾았독" : "You"}
                  </span>
                  <p className="text-sm leading-6">{message.text}</p>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5 rounded-[1.25rem] border border-primary/10 bg-primary-fixed/30 p-4 backdrop-blur-sm">
          {currentPrompt ? (
            <form
              className="flex flex-col gap-3 md:flex-row"
              onSubmit={(event) => {
                event.preventDefault();
                onSubmitAnswer();
              }}
            >
              <input
                type="text"
                value={draftAnswer}
                onChange={(event) => onDraftAnswerChange(event.target.value)}
                placeholder="짧게 답해도 됩니다"
                className="h-12 flex-1 rounded-xl border border-primary/10 bg-white px-4 text-sm text-on-surface outline-none transition-shadow placeholder:text-outline-variant focus:shadow-[0_0_0_4px_rgba(64,89,170,0.12)]"
              />
              <button
                type="submit"
                className="h-12 cursor-pointer rounded-xl bg-primary px-6 text-sm font-extrabold text-on-primary transition-transform active:scale-95"
              >
                답변 보내기
              </button>
            </form>
          ) : (
            <div className="text-left">
              <p className="font-headline text-lg font-extrabold tracking-tight text-primary">
                검색할 정보가 충분해졌어요
              </p>
              <p className="mt-1 text-sm leading-6 text-on-surface-variant">
                아래처럼 정리해서 바로 검색 결과로 넘길 수 있습니다.
              </p>
              <div className="mt-4 rounded-2xl border border-primary/10 bg-white px-4 py-3 shadow-[0_10px_24px_rgba(25,28,30,0.04)]">
                <p className="text-sm font-semibold text-on-surface">
                  {summaryQuery}
                </p>
              </div>
              <div className="mt-4 flex flex-col gap-3 md:flex-row">
                <button
                  type="button"
                  onClick={onSearchNow}
                  disabled={isNavigating}
                  className="cursor-pointer rounded-xl bg-primary px-6 py-3 text-sm font-extrabold text-on-primary transition-transform active:scale-95 disabled:cursor-wait disabled:opacity-70"
                >
                  {isNavigating ? "검색 중..." : "이 정보로 검색하기"}
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="cursor-pointer rounded-xl border border-primary/15 bg-white px-6 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/5"
                >
                  조금 더 수정할게요
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
