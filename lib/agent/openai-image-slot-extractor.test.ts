import { describe, expect, it } from "vitest";
import { extractSearchSlotsFromImageWithOpenAI } from "@/lib/agent/openai-image-slot-extractor";

describe("extractSearchSlotsFromImageWithOpenAI", () => {
  it("returns null when no API key is configured", async () => {
    const image = new File(["fake"], "wallet.png", { type: "image/png" });

    await expect(
      extractSearchSlotsFromImageWithOpenAI(image, ""),
    ).resolves.toBeNull();
  });
});
