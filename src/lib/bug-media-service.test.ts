import { describe, expect, it } from "vitest";
import { canonicalAttachmentContentType, getAttachmentKind } from "@/lib/bug-media-service";

describe("bug media service helpers", () => {
  it("normalizes recorded webm mime types before storage upload", () => {
    expect(canonicalAttachmentContentType({ type: "video/webm;codecs=vp9" })).toBe("video/webm");
    expect(canonicalAttachmentContentType({ type: "video/webm;codecs=vp8" })).toBe("video/webm");
  });

  it("classifies video recordings as video attachments", () => {
    expect(getAttachmentKind({ type: "video/webm;codecs=vp9" })).toBe("video");
  });
});
