import { maskSensitiveText } from "@/lib/agent/guardrails";
import type { SearchSlots } from "@/lib/agent/state";

type MemoryEntry = {
  expiresAt: number;
  slots: Partial<SearchSlots>;
};

const SESSION_MEMORY_TTL_MS = 1000 * 60 * 60;
const sessionMemory = new Map<string, MemoryEntry>();

function pruneExpiredMemory() {
  const now = Date.now();

  for (const [sessionId, entry] of sessionMemory.entries()) {
    if (entry.expiresAt <= now) {
      sessionMemory.delete(sessionId);
    }
  }
}

function maskSlotValue(value: string | undefined) {
  return value ? maskSensitiveText(value) : undefined;
}

export function mergeSearchSlots(
  remembered: Partial<SearchSlots> | undefined,
  next: Partial<SearchSlots>,
) {
  return {
    ...remembered,
    ...Object.fromEntries(
      Object.entries(next).filter(([, value]) => value !== undefined),
    ),
  } as Partial<SearchSlots>;
}

export function saveSessionSearchSlots(
  sessionId: string | undefined | null,
  slots: Partial<SearchSlots>,
) {
  if (!sessionId) {
    return;
  }

  pruneExpiredMemory();

  const remembered = sessionMemory.get(sessionId)?.slots;
  const merged = mergeSearchSlots(remembered, {
    ...slots,
    address: maskSlotValue(slots.address),
    placeHint: maskSlotValue(slots.placeHint),
  });

  sessionMemory.set(sessionId, {
    expiresAt: Date.now() + SESSION_MEMORY_TTL_MS,
    slots: merged,
  });
}

export function getSessionSearchSlots(sessionId: string | undefined | null) {
  if (!sessionId) {
    return undefined;
  }

  pruneExpiredMemory();
  return sessionMemory.get(sessionId)?.slots;
}
