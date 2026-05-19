type SearchInput = {
  query?: string;
  hasImage?: boolean;
};

export function maskSensitiveText(value: string) {
  return value.replace(/\b01[016789][-\s]?\d{3,4}[-\s]?\d{4}\b/g, "[전화번호]");
}

export function assertSearchInputAllowed(input: SearchInput) {
  if (!input.query?.trim() && !input.hasImage) {
    throw new Error("검색할 단서가 필요합니다.");
  }
}

export function sanitizeAssistantMessage(value: string) {
  return value
    .replace(/확실히\s*본인\s*물건입니다\.?/g, "본인 물건일 가능성이 있는 후보입니다.")
    .replace(/반드시\s*본인\s*물건입니다\.?/g, "본인 물건일 가능성이 있는 후보입니다.")
    .trim();
}
