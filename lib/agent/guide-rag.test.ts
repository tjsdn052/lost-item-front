import { describe, expect, it } from "vitest";
import { retrievePickupGuideContext } from "@/lib/agent/guide-rag";

describe("retrievePickupGuideContext", () => {
  it("falls back to local pickup guide documents without Supabase configuration", async () => {
    const context = await retrievePickupGuideContext("신분증 관리번호");

    expect(context.length).toBeGreaterThan(0);
    expect(context.join(" ")).toContain("신분증");
  });
});
