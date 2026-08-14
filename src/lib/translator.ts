/**
 * Bidirectional Arabic <-> English Translation Utility
 *
 * Automatically detects whether text is Arabic or English and translates
 * with fallback redundancy (MyMemory -> Google Translate single endpoint).
 */

export function hasArabicText(value: string): boolean {
  return /[\u0600-\u06FF]/.test(value);
}

export function detectLanguage(text: string): "ar" | "en" {
  return hasArabicText(text) ? "ar" : "en";
}

function splitForTranslation(text: string): string[] {
  const chunks: string[] = [];
  for (const block of text.split(/(\n+)/)) {
    if (!block || /^\n+$/.test(block)) {
      chunks.push(block);
      continue;
    }
    for (let index = 0; index < block.length; index += 450) {
      chunks.push(block.slice(index, index + 450));
    }
  }
  return chunks;
}

type MyMemoryResponse = {
  responseData?: { translatedText?: string };
  responseStatus?: number;
  responseDetails?: string;
};

async function translateChunkWithMyMemory(
  chunk: string,
  from: "ar" | "en",
  to: "ar" | "en"
): Promise<string> {
  const params = new URLSearchParams({
    q: chunk,
    langpair: `${from}|${to}`,
  });
  const response = await fetch(`https://api.mymemory.translated.net/get?${params}`);
  if (!response.ok) throw new Error(`MyMemory HTTP ${response.status}`);
  const data = (await response.json()) as MyMemoryResponse;
  if (data.responseStatus && data.responseStatus >= 400) {
    throw new Error(data.responseDetails || "MyMemory rejected request");
  }
  return data.responseData?.translatedText ?? chunk;
}

async function translateChunkWithGoogle(
  chunk: string,
  from: "ar" | "en",
  to: "ar" | "en"
): Promise<string> {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${from}&tl=${to}&dt=t&q=${encodeURIComponent(
    chunk
  )}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Google Translate HTTP ${response.status}`);
  const data = (await response.json()) as unknown;
  if (Array.isArray(data) && Array.isArray(data[0])) {
    return (data[0] as unknown[])
      .map((item) => (Array.isArray(item) ? String(item[0] ?? "") : ""))
      .join("");
  }
  return chunk;
}

/**
 * Translates text between Arabic and English.
 * Automatically infers source/target if not explicitly provided.
 */
export async function translateText(
  text: string,
  targetLang?: "ar" | "en",
  sourceLang?: "ar" | "en"
): Promise<string> {
  const trimmed = text.trim();
  if (!trimmed) return "";

  const from: "ar" | "en" = sourceLang ?? detectLanguage(trimmed);
  const to: "ar" | "en" = targetLang ?? (from === "ar" ? "en" : "ar");

  if (from === to) return text;

  const chunks = splitForTranslation(text);

  const results = await Promise.all(
    chunks.map(async (chunk) => {
      if (!chunk.trim() || /^\n+$/.test(chunk)) return chunk;

      // Tier 1: Try MyMemory
      try {
        return await translateChunkWithMyMemory(chunk, from, to);
      } catch {
        // Tier 2: Fallback to Google Translate endpoint
        try {
          return await translateChunkWithGoogle(chunk, from, to);
        } catch {
          return chunk;
        }
      }
    })
  );

  return results.join("");
}
