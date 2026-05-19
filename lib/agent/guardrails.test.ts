import { describe, expect, it } from "vitest";
import {
  assertSearchInputAllowed,
  maskSensitiveText,
  sanitizeAssistantMessage,
} from "@/lib/agent/guardrails";

describe("agent guardrails", () => {
  it("masks phone-like numbers before logs or durable memory", () => {
    expect(maskSensitiveText("제 번호는 010-1234-5678 입니다")).toBe(
      "제 번호는 [전화번호] 입니다",
    );
  });

  it("rejects an empty search request", () => {
    expect(() => assertSearchInputAllowed({ query: "" })).toThrow(
      "검색할 단서가 필요합니다.",
    );
  });

  it("allows image-only request to reach the agent layer", () => {
    expect(() =>
      assertSearchInputAllowed({ query: "", hasImage: true }),
    ).not.toThrow();
  });

  it("removes certainty claims from assistant output", () => {
    expect(sanitizeAssistantMessage("확실히 본인 물건입니다. 기관에 확인하세요.")).toBe(
      "본인 물건일 가능성이 있는 후보입니다. 기관에 확인하세요.",
    );
  });
});
