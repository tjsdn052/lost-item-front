"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  type CSSProperties,
  type ChangeEvent,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  type ChatMessage,
  SearchChatPanel,
} from "@/components/home/search-chat-panel";
import { SearchLoadingLottie } from "@/components/home/search-loading-lottie";
import { searchLostItemsDirect } from "@/lib/lost-items-search-browser";
import {
  createSearchResultCacheKey,
  saveSearchResultToSession,
} from "@/lib/search-result-session-cache";
import { PlusIcon, SearchIcon } from "@/components/ui/icons";

type SearchBoxProps = {
  defaultQuery: string;
  defaultSessionId?: string | null;
};

type SearchStage =
  | "idle"
  | "analyzing"
  | "matching"
  | "clarifying"
  | "ready"
  | "navigating";

type AttachedImage = {
  id: string;
  file: File;
  name: string;
  previewUrl: string;
};

type SearchAgentResponse = {
  token?: string;
  cacheKey?: string;
  sessionId?: string | null;
  assistantMessage?: string | null;
  itemCount: number;
};

type ProgressStep = {
  id: string;
  label: string;
};

type ProgressTimeline = {
  steps: ProgressStep[];
  checkpoints: number[];
};

const FIRST_BUBBLE_TARGET_Y_OFFSET = -6;

const CLARIFY_PROMPT = {
  title: "추가 정보를 알려주세요",
  description: "서버가 더 정확한 매칭을 위해 추가 정보를 요청했습니다.",
  suggestions: [] as string[],
};

const SEARCH_PROGRESS_TIMELINE: ProgressTimeline = {
  steps: [
    { id: "session", label: "이전 검색 흐름과 세션을 정리하고 있어요" },
    { id: "vector", label: "비슷한 분실물을 먼저 넓게 찾고 있어요" },
    { id: "rerank", label: "관련도가 높은 결과만 다시 고르고 있어요" },
    { id: "save", label: "검색 결과와 대화 기록을 정리하고 있어요" },
  ],
  checkpoints: [0, 1800, 4300, 6600],
};

const CLARIFY_PROGRESS_TIMELINE: ProgressTimeline = {
  steps: [
    { id: "session", label: "이전 검색 흐름과 세션을 정리하고 있어요" },
    { id: "vector", label: "비슷한 분실물을 먼저 살펴보고 있어요" },
    { id: "clarify", label: "지금 더 물어봐야 할 내용을 정리하고 있어요" },
  ],
  checkpoints: [0, 2400, 5600],
};

function getProgressTimeline(stage: SearchStage): ProgressTimeline {
  if (stage === "clarifying") {
    return CLARIFY_PROGRESS_TIMELINE;
  }

  if (stage === "navigating") {
    return SEARCH_PROGRESS_TIMELINE;
  }

  return {
    steps: [{ id: stage, label: "검색어와 첨부 정보를 확인하고 있어요" }],
    checkpoints: [0],
  };
}

function createMessage(role: ChatMessage["role"], text: string): ChatMessage {
  return {
    id: `${role}-${text}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    role,
    text,
  };
}

function buildSearchQuery(
  baseQuery: string,
  followUpAnswer?: string,
) {
  return [baseQuery.trim(), followUpAnswer?.trim()]
    .filter(Boolean)
    .join(", ");
}

function createSearchSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `search-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
}

function getInitialClarifyUserMessage(query: string) {
  return query.trim() || "이미지로 먼저 검색해 봤어요.";
}

export function SearchBox({
  defaultQuery,
  defaultSessionId,
}: SearchBoxProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRowRef = useRef<HTMLDivElement>(null);
  const statusRowRef = useRef<HTMLDivElement>(null);
  const firstUserBubbleRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachedImagesRef = useRef<AttachedImage[]>([]);
  const morphTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const morphStartRectRef = useRef<DOMRect | null>(null);
  const activeSearchControllerRef = useRef<AbortController | null>(null);
  const [query, setQuery] = useState(defaultQuery);
  const [attachedImages, setAttachedImages] = useState<AttachedImage[]>([]);
  const [draftAnswer, setDraftAnswer] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [searchSessionId, setSearchSessionId] = useState<string | null>(
    () => defaultSessionId ?? createSearchSessionId(),
  );
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [searchStage, setSearchStage] = useState<SearchStage>("idle");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeProgressIndex, setActiveProgressIndex] = useState(0);
  const [agentProgressSteps, setAgentProgressSteps] = useState<ProgressStep[]>([]);
  const searchRunIdRef = useRef(0);
  const [isMorphingFirstBubble, setIsMorphingFirstBubble] = useState(false);
  const [morphBubble, setMorphBubble] = useState<{
    text: string;
    style: CSSProperties;
  } | null>(null);

  const progressTimeline = useMemo(
    () => getProgressTimeline(searchStage),
    [searchStage],
  );
  const progressSteps =
    agentProgressSteps.length > 0 ? agentProgressSteps : progressTimeline.steps;
  const isSearchSubmitting =
    searchStage === "analyzing" ||
    searchStage === "matching" ||
    searchStage === "clarifying" ||
    searchStage === "navigating" ||
    isPending;
  const isStatusVisible =
    searchStage !== "idle" && searchStage !== "ready";

  function updateSearchStage(nextStage: SearchStage) {
    setSearchStage(nextStage);
    setActiveProgressIndex(0);
    setAgentProgressSteps([]);
  }

  useEffect(() => {
    if (!isStatusVisible) {
      return;
    }

    if (progressTimeline.checkpoints.length <= 1) {
      return;
    }

    const timers = progressTimeline.checkpoints
      .slice(1)
      .map((checkpoint, index) =>
        window.setTimeout(() => {
          setActiveProgressIndex(index + 1);
        }, checkpoint),
      );

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [isStatusVisible, progressTimeline]);

  useEffect(() => {
    attachedImagesRef.current = attachedImages;
  }, [attachedImages]);

  useEffect(() => {
    setQuery(defaultQuery);
  }, [defaultQuery]);

  useEffect(() => {
    if (defaultSessionId) {
      setSearchSessionId(defaultSessionId);
    }
  }, [defaultSessionId]);

  useEffect(() => {
    return () => {
      activeSearchControllerRef.current?.abort();
      attachedImagesRef.current.forEach((image) => {
        URL.revokeObjectURL(image.previewUrl);
      });
    };
  }, []);

  function navigateToSearch(
    nextQuery: string,
    {
      sessionId,
      cacheKey,
      token,
    }: {
      sessionId?: string | null;
      cacheKey?: string;
      token?: string;
    },
  ) {
    updateSearchStage("navigating");
    startTransition(() => {
      const params = new URLSearchParams({
        q: nextQuery,
      });

      if (sessionId) {
        params.set("sid", sessionId);
      }

      if (token) {
        params.set("token", token);
      }

      if (cacheKey) {
        params.set("ck", cacheKey);
      }

      router.push(`/search?${params.toString()}`);
    });
  }

  function resetChat() {
    searchRunIdRef.current += 1;
    activeSearchControllerRef.current?.abort();
    activeSearchControllerRef.current = null;
    if (morphTimeoutRef.current) {
      clearTimeout(morphTimeoutRef.current);
      morphTimeoutRef.current = null;
    }
    setDraftAnswer("");
    setMessages([]);
    setSearchSessionId((current) => current ?? createSearchSessionId());
    updateSearchStage("idle");
    setSubmitError(null);
    setIsMorphingFirstBubble(false);
    setMorphBubble(null);
    morphStartRectRef.current = null;
  }

  async function requestAgentResponse(
    nextQuery: string,
    sessionId?: string | null,
  ): Promise<SearchAgentResponse | null> {
    activeSearchControllerRef.current?.abort();
    const controller = new AbortController();
    activeSearchControllerRef.current = controller;

    try {
      const normalizedQuery = nextQuery.trim();
      const latestImage = attachedImages[attachedImages.length - 1]?.file ?? null;
      const result = await searchLostItemsDirect({
        query: normalizedQuery,
        sessionId: sessionId ?? undefined,
        image: latestImage,
      }, {
        signal: controller.signal,
        onProgress: (progress) => {
          setActiveProgressIndex(0);
          setAgentProgressSteps([
            {
              id: progress.node,
              label: progress.label,
            },
          ]);
        },
      });

      if (activeSearchControllerRef.current === controller) {
        activeSearchControllerRef.current = null;
      }

      const cacheKey = createSearchResultCacheKey();
      saveSearchResultToSession(cacheKey, result);

      return {
        token: result.token,
        cacheKey,
        sessionId: result.sessionId,
        assistantMessage: result.assistantMessage,
        itemCount: result.items.length,
      };
    } catch (error) {
      if (activeSearchControllerRef.current === controller) {
        activeSearchControllerRef.current = null;
      }
      if (error instanceof DOMException && error.name === "AbortError") {
        return null;
      }
      return null;
    }
  }

  function handleSelectImage(event: ChangeEvent<HTMLInputElement>) {
    const nextFiles = Array.from(event.target.files ?? []);

    if (nextFiles.length === 0) {
      return;
    }

    const nextImages = nextFiles.map((file) => ({
      id: `${file.name}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      file,
      name: file.name,
      previewUrl: URL.createObjectURL(file),
    }));

    setAttachedImages((current) => [...current, ...nextImages]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function handleRemoveImage(imageId: string) {
    setAttachedImages((current) => {
      const imageToRemove = current.find((image) => image.id === imageId);

      if (imageToRemove) {
        URL.revokeObjectURL(imageToRemove.previewUrl);
      }

      return current.filter((image) => image.id !== imageId);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function playFirstBubbleMorph(initialQuery: string) {
    const containerRect = containerRef.current?.getBoundingClientRect();
    const startRect = morphStartRectRef.current;
    const targetRect = firstUserBubbleRef.current?.getBoundingClientRect();
    const searchRowHeight =
      searchRowRef.current?.getBoundingClientRect().height ?? 0;
    const statusRowHeight =
      statusRowRef.current?.getBoundingClientRect().height ?? 0;

    if (!containerRect || !startRect || !targetRect) {
      setIsMorphingFirstBubble(false);
      setMorphBubble(null);
      return;
    }

    setMorphBubble({
      text: initialQuery,
      style: {
        top: startRect.top - containerRect.top + 8,
        left: startRect.left - containerRect.left + 12,
        width: startRect.width - 24,
        height: startRect.height - 10,
        opacity: 1,
        transform: "scale(1)",
      },
    });

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setMorphBubble({
          text: initialQuery,
          style: {
            top:
              targetRect.top -
              containerRect.top +
              FIRST_BUBBLE_TARGET_Y_OFFSET -
              searchRowHeight -
              statusRowHeight,
            left: targetRect.left - containerRect.left,
            width: targetRect.width,
            height: targetRect.height,
            opacity: 0.12,
            transform: "scale(0.92)",
          },
        });
      });
    });

    morphTimeoutRef.current = setTimeout(() => {
      setMorphBubble(null);
      setIsMorphingFirstBubble(false);
      morphStartRectRef.current = null;
      morphTimeoutRef.current = null;
    }, 620);
  }

  function openClarifyFlow(
    initialQuery: string,
    assistantMessage: string,
    sessionId?: string | null,
  ) {
    const userMessage = getInitialClarifyUserMessage(initialQuery);

    setIsChatOpen(true);
    setDraftAnswer("");
    setSearchSessionId(
      (current) => sessionId ?? current ?? createSearchSessionId(),
    );
    updateSearchStage("ready");
    setIsMorphingFirstBubble(true);
    morphStartRectRef.current = searchRowRef.current?.getBoundingClientRect() ?? null;
    setMessages([
      createMessage("user", userMessage),
      createMessage("assistant", assistantMessage.trim()),
    ]);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        playFirstBubbleMorph(initialQuery);
      });
    });
  }

  async function handleSubmitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const nextQuery = query.trim();
    const hasAttachedImage = attachedImages.length > 0;

    if (!nextQuery && !hasAttachedImage) {
      return;
    }

    const currentRunId = searchRunIdRef.current + 1;
    searchRunIdRef.current = currentRunId;
    setSubmitError(null);
    updateSearchStage("analyzing");

    updateSearchStage(hasAttachedImage ? "navigating" : "matching");
    const agentResponse = await requestAgentResponse(nextQuery, searchSessionId);
    if (searchRunIdRef.current !== currentRunId) {
      return;
    }
    if (!agentResponse?.cacheKey) {
      updateSearchStage("idle");
      setSubmitError("검색 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    if (agentResponse.itemCount > 0 || !agentResponse.assistantMessage?.trim()) {
      setIsChatOpen(false);
      navigateToSearch(
        nextQuery,
        {
          sessionId: agentResponse.sessionId ?? searchSessionId,
          cacheKey: agentResponse.cacheKey,
          token: agentResponse.token,
        },
      );
      return;
    }

    updateSearchStage("clarifying");
    openClarifyFlow(
      nextQuery,
      agentResponse.assistantMessage,
      agentResponse.sessionId,
    );
  }

  async function handleSubmitAnswer(rawValue?: string) {
    const answer = (rawValue ?? draftAnswer).trim();

    if (!answer) {
      return;
    }

    setSubmitError(null);
    const nextMessages = [...messages, createMessage("user", answer)];
    const nextQuery = buildSearchQuery(query, answer);
    setMessages(nextMessages);
    setDraftAnswer("");
    setQuery(nextQuery);
    updateSearchStage("clarifying");

    const agentResponse = await requestAgentResponse(nextQuery, searchSessionId);

    if (agentResponse?.sessionId) {
      setSearchSessionId(agentResponse.sessionId);
    }

    if (!agentResponse?.cacheKey) {
      updateSearchStage("ready");
      setSubmitError("검색 응답을 받지 못했습니다. 잠시 후 다시 시도해 주세요.");
      return;
    }

    if (agentResponse.itemCount > 0 || !agentResponse.assistantMessage?.trim()) {
      navigateToSearch(
        nextQuery,
        {
          sessionId: agentResponse.sessionId ?? searchSessionId,
          cacheKey: agentResponse.cacheKey,
          token: agentResponse.token,
        },
      );
      return;
    }

    setMessages([
      ...nextMessages,
      createMessage("assistant", agentResponse.assistantMessage.trim()),
    ]);
    updateSearchStage("ready");
  }

  return (
    <div ref={containerRef} className="relative mx-auto w-full max-w-3xl">
      <SearchLoadingLottie visible={isStatusVisible} />
      <div
        className={`overflow-hidden rounded-[1.6rem] border border-outline-variant/30 transition-all duration-500 ease-out ${
          isChatOpen
            ? "bg-[linear-gradient(180deg,rgba(220,225,255,0.52)_0%,rgba(255,255,255,0.98)_18%,rgba(255,255,255,1)_100%)] shadow-[0_28px_80px_rgba(0,35,111,0.16)] ring-2 ring-primary/10"
            : "bg-surface-container-lowest shadow-[0_10px_30px_rgba(0,35,111,0.06)]"
        }`}
      >
        <div
          className={`overflow-hidden transition-all duration-500 ease-out ${
            isChatOpen
              ? "max-h-0 opacity-0"
              : attachedImages.length > 0
                ? "max-h-56 opacity-100"
                : "max-h-28 opacity-100"
          }`}
        >
          <form onSubmit={handleSubmitSearch}>
            <div className="px-4 py-3">
              <div ref={searchRowRef} className="flex items-center gap-3">
                <SearchIcon className="h-5 w-5 text-outline" />
                <input
                  type="text"
                  name="q"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="홍대에서 검은색 지갑"
                  className="w-full bg-transparent py-2 text-lg text-on-surface outline-none placeholder:text-outline-variant"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleSelectImage}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-primary/12 bg-primary/5 text-primary transition-all hover:-translate-y-0.5 hover:bg-primary/10 active:scale-95"
                  aria-label="이미지 첨부"
                >
                  <PlusIcon className="h-5 w-5" />
                </button>
                <button
                  type="submit"
                  disabled={isSearchSubmitting}
                  className="shrink-0 cursor-pointer rounded-xl bg-primary px-5 py-3 text-sm font-extrabold text-on-primary transition-transform active:scale-95 disabled:cursor-wait disabled:opacity-70"
                >
                  {isSearchSubmitting ? "검색 중..." : "검색"}
                </button>
              </div>

              {attachedImages.length > 0 ? (
                <div className="no-scrollbar mt-3 overflow-x-auto pt-2">
                  <div className="flex min-w-max gap-3 px-1">
                    {[...attachedImages].reverse().map((image) => (
                      <div key={image.id} className="relative h-14 w-14 shrink-0">
                        <Image
                          src={image.previewUrl}
                          alt={image.name}
                          width={56}
                          height={56}
                          unoptimized
                          className="h-14 w-14 rounded-xl object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(image.id)}
                          className="absolute -right-1.5 -top-1.5 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-full bg-primary text-sm font-bold text-on-primary shadow-[0_8px_16px_rgba(0,35,111,0.18)] transition-transform hover:scale-105 active:scale-95"
                          aria-label="첨부 이미지 제거"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </form>
        </div>

        <div
          className={`overflow-hidden transition-all duration-500 ease-out ${
            isStatusVisible ? "max-h-20 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div
            ref={statusRowRef}
            className="px-4 pb-4"
          >
            <div className="flex items-center gap-2 rounded-[1.1rem] border border-primary/10 bg-primary-fixed/28 px-4 py-3 text-sm font-semibold text-primary">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
              </span>
              {progressSteps[Math.min(activeProgressIndex, progressSteps.length - 1)]
                ?.label ?? ""}
            </div>
          </div>
        </div>

        <SearchChatPanel
          isOpen={isChatOpen}
          messages={messages}
          draftAnswer={draftAnswer}
          currentPrompt={CLARIFY_PROMPT}
          isNavigating={searchStage === "navigating" || isPending}
          firstUserBubbleRef={firstUserBubbleRef}
          hideFirstUserBubble={isMorphingFirstBubble}
          onDraftAnswerChange={setDraftAnswer}
          onSubmitAnswer={() => {
            void handleSubmitAnswer();
          }}
          onSearchNow={() => {
            void handleSubmitAnswer();
          }}
          onClose={() => {
            resetChat();
            setIsChatOpen(false);
          }}
        />

        {morphBubble ? (
          <div
            className="pointer-events-none absolute z-20 overflow-hidden rounded-[1.25rem] bg-primary text-on-primary shadow-[0_18px_34px_rgba(0,35,111,0.22)]"
            style={{
              ...morphBubble.style,
              position: "absolute",
              transition:
                "top 620ms cubic-bezier(0.2, 0.78, 0.2, 1), left 620ms cubic-bezier(0.2, 0.78, 0.2, 1), width 620ms cubic-bezier(0.2, 0.78, 0.2, 1), height 620ms cubic-bezier(0.2, 0.78, 0.2, 1), opacity 620ms ease, transform 620ms cubic-bezier(0.2, 0.78, 0.2, 1)",
            }}
          >
            <div className="flex h-full items-center px-5 py-3">
              <p className="truncate text-base font-semibold">{morphBubble.text}</p>
            </div>
          </div>
        ) : null}
      </div>
      {submitError ? (
        <p className="mt-3 px-2 text-sm font-medium text-error">{submitError}</p>
      ) : null}
    </div>
  );
}
