import { describe, expect, it } from "vitest";
import { dictionaries, directionFor, isLanguage, translate } from "@/lib/i18n";

describe("dictionaries", () => {
  it("keeps Arabic in sync with every English key", () => {
    const missing = Object.keys(dictionaries.en).filter(
      (key) => !(key in dictionaries.ar),
    );
    expect(missing).toEqual([]);
  });

  it("has no extra Arabic-only keys", () => {
    const extra = Object.keys(dictionaries.ar).filter((key) => !(key in dictionaries.en));
    expect(extra).toEqual([]);
  });
});

describe("translate", () => {
  it("returns the Arabic string when available", () => {
    expect(translate("ar", "nav.bugs")).toBe("الأخطاء");
  });

  it("fills placeholders", () => {
    expect(translate("en", "shell.notificationsUnread", { count: 3 })).toBe(
      "Notifications, 3 unread",
    );
  });

  it("leaves unknown placeholders untouched", () => {
    expect(translate("en", "shell.notificationsUnread")).toContain("{count}");
  });
});

describe("directionFor / isLanguage", () => {
  it("maps Arabic to rtl", () => {
    expect(directionFor("ar")).toBe("rtl");
    expect(directionFor("en")).toBe("ltr");
  });

  it("validates stored values", () => {
    expect(isLanguage("ar")).toBe(true);
    expect(isLanguage("fr")).toBe(false);
  });
});
