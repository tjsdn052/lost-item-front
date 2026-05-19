# Agent RAG Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the removed external search API with a Next.js full-stack LangGraph agent that searches the Korean police found-item OpenAPI and guides the existing conversational UI.

**Architecture:** Keep the current home/search UI contract and replace the server-side implementation behind `/api/search/*`, recent items, and `/api/police-guide`. The agent will normalize user text into structured search slots, call typed police OpenAPI tools, deduplicate and rank found-item candidates, ask a follow-up question when the query is too vague, and generate pickup guidance only from retrieved detail facts and local guide text.

**Tech Stack:** Next.js 16 App Router Route Handlers, TypeScript, Vitest, OpenAI Responses API with `gpt-5.5`, LangGraph JS, LangChain/OpenAI helpers, police public data XML API, optional Supabase env placeholders for later durable memory/RAG.

---

### Project Shape Observed

**Existing UI contract to preserve:**
- `components/home/search-box.tsx` posts `FormData` to `/api/search/submit` and expects `LostItemsSearchResult & { token?: string }`.
- `components/search/search-page-client.tsx` hydrates cached results and can call `/api/search/submit` again.
- `components/search/search-results-grid.tsx` and `components/home/recent-items-carousel.tsx` open `/api/police-guide` with `{ atcId, item }`.
- `data/search-results.ts` is the card DTO consumed by all result cards.

**External API replacement points:**
- Replace `LOST_ITEMS_API_BASE_URL` usage in `lib/lost-items-search.ts`.
- Replace old recent endpoint usage in `lib/recent-items.ts`.
- Replace HTML scraping detail path in `lib/police-guide.ts` with `getLosfundDetailInfo`.

**Police OpenAPI found-item endpoints from HWP:**
- Base: `https://apis.data.go.kr/1320000/LosfundInfoInqireService`
- `getLosfundInfoAccTpNmCstdyPlace`: `serviceKey`, `PRDT_NM`, `DEP_PLACE`, `pageNo`, `numOfRows`
- `getLosfundInfoAccToClAreaPd`: `serviceKey`, `PRDT_CL_CD_01`, `PRDT_CL_CD_02`, `FD_COL_CD`, `START_YMD`, `END_YMD`, `N_FD_LCT_CD`, `pageNo`, `numOfRows`
- `getLosfundDetailInfo`: `serviceKey`, `ATC_ID`, `FD_SN`
- `getLosfundInfoAccToLc`: `serviceKey`, `PRDT_NM`, `ADDR`, `pageNo`, `numOfRows`

### Task 1: Test Harness

**Files:**
- Modify: `package.json`
- Create: `vitest.config.mts`

- [ ] **Step 1: Install test dependencies**

Run:

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/dom vite-tsconfig-paths
```

- [ ] **Step 2: Add Vitest config**

Create `vitest.config.mts` with jsdom and TS path support from the bundled Next 16 Vitest guide.

- [ ] **Step 3: Add scripts**

Add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Run test command**

Run:

```bash
npm run test
```

Expected: exits successfully with no tests found or with the first failing test once Task 2 begins.

### Task 2: Police XML Parser and DTO Mapping

**Files:**
- Create: `lib/police-openapi/types.ts`
- Create: `lib/police-openapi/xml.ts`
- Create: `lib/police-openapi/mappers.ts`
- Test: `lib/police-openapi/xml.test.ts`
- Test: `lib/police-openapi/mappers.test.ts`

- [ ] **Step 1: Write failing parser tests**

Cover:
- single `<item>` body parses as one item
- `<items><item>...</item></items>` parses as multiple items
- API error response returns `resultCode` and `resultMsg`
- empty body returns no items

- [ ] **Step 2: Implement XML parser**

Use `DOMParser` when available through jsdom/Vitest and normalize text content by tag name. Keep it dependency-light and schema-specific.

- [ ] **Step 3: Write failing mapper tests**

Cover:
- found-item list fields map to `SearchResult`
- missing image/no-image URL is omitted
- detail fields map to `PoliceGuideDetail`
- match labels are deterministic and avoid claiming certainty

- [ ] **Step 4: Implement mappers**

Map `atcId`, `fdSn`, `fdPrdtNm`, `fdSbjt`, `fdYmd`, `depPlace`, `fdPlace`, `prdtClNm`, `fdFilePathImg`, `clrNm`, `tel`, `uniq`, `csteSteNm`, `orgNm`.

### Task 3: Police OpenAPI Client

**Files:**
- Create: `lib/police-openapi/client.ts`
- Test: `lib/police-openapi/client.test.ts`
- Modify: `.env.example`

- [ ] **Step 1: Write failing client tests**

Use injected `fetch` to verify:
- `serviceKey` is included without exposing it to the browser
- `getLosfundInfoAccTpNmCstdyPlace` sends `PRDT_NM`, `DEP_PLACE`, pagination
- `getLosfundDetailInfo` sends both `ATC_ID` and `FD_SN`
- non-`00` result codes throw a typed error

- [ ] **Step 2: Implement client**

Expose typed functions:
- `searchFoundItemsByName`
- `searchFoundItemsByCategoryAreaPeriod`
- `searchFoundItemsByLocation`
- `getFoundItemDetail`

- [ ] **Step 3: Update env example**

Use:

```env
PUBLIC_DATA_API_KEY=
OPENAI_API_KEY=
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

### Task 4: Agent State, Guardrails, and Search Strategy

**Files:**
- Create: `lib/agent/state.ts`
- Create: `lib/agent/guardrails.ts`
- Create: `lib/agent/search-strategy.ts`
- Test: `lib/agent/guardrails.test.ts`
- Test: `lib/agent/search-strategy.test.ts`

- [ ] **Step 1: Write failing guardrail tests**

Cover:
- phone-like numbers are masked for logs/memory
- empty query and no image is rejected
- overly broad query asks for more information
- output wording does not say the item is definitely the user's item

- [ ] **Step 2: Implement guardrails**

Implement deterministic functions before model calls. Keep policy outside prompts.

- [ ] **Step 3: Write failing strategy tests**

Cover:
- `검은 지갑 홍대` becomes a name-based found-item search with `PRDT_NM=지갑`
- missing item name returns a follow-up slot
- date hints are normalized to `YYYYMMDD` ranges using the Asia/Seoul local date
- result ranking favors item name, color, place, and recent found date

- [ ] **Step 4: Implement strategy**

Use a conservative rule-based baseline that can run without OpenAI, then allow OpenAI extraction to improve it when `OPENAI_API_KEY` exists.

### Task 5: LangGraph Agent Orchestration

**Files:**
- Create: `lib/agent/found-item-agent.ts`
- Test: `lib/agent/found-item-agent.test.ts`
- Modify: `lib/lost-items-search.ts`
- Modify: `lib/lost-items-search-shared.ts`

- [ ] **Step 1: Write failing agent tests**

Use fake tools and fake model output to verify:
- enough slots call search tools and return card items
- vague query returns `assistantMessage` with no items
- duplicate `atcId` and `fdSn` candidates are removed
- `sessionId` is preserved or generated

- [ ] **Step 2: Implement agent**

Compile a LangGraph workflow with nodes:
- `normalizeInput`
- `extractSlots`
- `searchFoundItems`
- `rankCandidates`
- `answerOrAskFollowUp`

- [ ] **Step 3: Replace old external API search**

Make `searchLostItems` call the agent. Keep image input accepted but return a clear text-only MVP message when only an image is provided.

### Task 6: Pickup Guide and Recent Items

**Files:**
- Modify: `lib/police-guide.ts`
- Modify: `lib/recent-items.ts`
- Test: `lib/police-guide.test.ts`
- Test: `lib/recent-items.test.ts`

- [ ] **Step 1: Write failing guide tests**

Cover:
- detail API facts produce `PoliceGuideDetail`
- fallback guidance mentions phone/place/management facts only when present
- generated guidance prompt forbids unsupported claims

- [ ] **Step 2: Replace HTML scraping with OpenAPI detail**

Use `getFoundItemDetail(atcId, fdSn)` and default `fdSn` to `1` when the card does not carry it.

- [ ] **Step 3: Write failing recent tests**

Cover:
- recent items call the found-item category/period endpoint with a recent date window
- missing API key returns an empty array without throwing

- [ ] **Step 4: Implement recent items**

Use found-item OpenAPI and map into the existing carousel DTO.

### Task 7: UI Copy Alignment

**Files:**
- Modify: `components/home/search-box.tsx`
- Modify: `components/home/recent-items-section.tsx`
- Modify: `components/search/search-results-grid.tsx`
- Modify: `components/search/search-status-banner.tsx`

- [ ] **Step 1: Update copy only where needed**

Use "습득물 후보", "찾기 요청", and "탐색" instead of implying an official loss report.

- [ ] **Step 2: Keep layout stable**

No broad visual redesign. Preserve the current card grid, chat panel, and modal.

### Task 8: Verification and Commits

**Files:**
- All changed files

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm run test
```

- [ ] **Step 2: Run lint and build**

Run:

```bash
npm run lint
npm run build
```

- [ ] **Step 3: Start dev server**

Run:

```bash
npm run dev
```

Open the local app and verify:
- home search with "홍대에서 잃어버린 검은 지갑"
- vague search asks a follow-up question
- search result cards render
- candidate selection opens the pickup guide modal

- [ ] **Step 4: Commit in small units**

Use Korean Conventional Commits:

```bash
git add package.json package-lock.json vitest.config.mts
git commit -m "chore: 테스트 환경을 추가함"
git add lib/police-openapi lib/agent lib/lost-items-search* lib/police-guide.ts lib/recent-items.ts app/api components .env.example
git commit -m "feat: 경찰청 습득물 검색 에이전트를 추가함"
```
