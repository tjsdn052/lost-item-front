import { describe, expect, it } from "vitest";
import {
  getSessionSearchSlots,
  mergeSearchSlots,
  saveSessionSearchSlots,
} from "@/lib/agent/session-memory";

describe("session search memory", () => {
  it("merges new slots over remembered slots without losing useful context", () => {
    expect(
      mergeSearchSlots(
        {
          itemName: "지갑",
          address: "서울 강남역",
          dateFrom: "20260518",
          dateTo: "20260518",
        },
        {
          itemName: "에어팟",
        },
      ),
    ).toMatchObject({
      itemName: "에어팟",
      address: "서울 강남역",
      dateFrom: "20260518",
      dateTo: "20260518",
    });
  });

  it("stores masked slots by session id", () => {
    saveSessionSearchSlots("session-memory-test", {
      itemName: "지갑",
      address: "서울 강남역 010-1234-5678",
    });

    expect(getSessionSearchSlots("session-memory-test")).toMatchObject({
      itemName: "지갑",
      address: "서울 강남역 [전화번호]",
    });
  });
});
