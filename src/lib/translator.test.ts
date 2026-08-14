import { describe, expect, it } from "vitest";
import { detectLanguage, hasArabicText } from "./translator";

describe("translator", () => {
  it("detects Arabic text correctly", () => {
    expect(hasArabicText("مرحبا بالعالم")).toBe(true);
    expect(hasArabicText("Hello world")).toBe(false);
    expect(hasArabicText("Bug in line 42: خطأ في المصادقة")).toBe(true);
    expect(detectLanguage("ملاحظة هامة")).toBe("ar");
    expect(detectLanguage("Important fix note")).toBe("en");
  });
});
