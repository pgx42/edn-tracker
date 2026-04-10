import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import DOMPurify from "dompurify";

// Cache data URLs so each media file is only loaded once per session
const mediaCache = new Map<string, string>();

// SVGs loaded as <img src="data:..."> are sandboxed — nested <image href="..."> refs can't load.
// This function inlines those refs into the SVG before serving it.
async function inlineSvgImages(svgDataUrl: string): Promise<string> {
  console.log("[inlineSvg] called, dataUrl prefix:", svgDataUrl.slice(0, 60));
  const b64 = svgDataUrl.replace(/^data:image\/svg\+xml;base64,/, "");
  if (b64 === svgDataUrl) {
    // Not a base64 SVG data URL — skip
    console.warn("[inlineSvg] unexpected format, not base64 SVG data URL");
    return svgDataUrl;
  }
  let svgText: string;
  try {
    // Strip whitespace — some base64 payloads have line breaks
    const cleanB64 = b64.replace(/\s/g, "");
    // Robust UTF-8 decode
    const bytes = Uint8Array.from(atob(cleanB64), (c) => c.charCodeAt(0));
    svgText = new TextDecoder().decode(bytes);
  } catch (e) {
    console.warn("[inlineSvg] Failed to decode SVG base64:", e);
    return svgDataUrl;
  }

  console.log("[inlineSvg] SVG text (first 300):", svgText.slice(0, 300));

  // Find local image refs inside the SVG
  const localRefs: string[] = [];
  const re = /<image[^>]+(?:xlink:href|href)="([^"]+)"/gi;
  let m: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((m = re.exec(svgText)) !== null) {
    const src = m[1];
    if (!src.startsWith("http") && !src.startsWith("data:") && !src.startsWith("blob:"))
      localRefs.push(src);
  }
  console.log("[inlineSvg] local refs found:", localRefs);
  if (localRefs.length === 0) return svgDataUrl;

  // Load each referenced image (may recurse for nested SVGs, but depth is always 1 in practice)
  await Promise.all([...new Set(localRefs)].map(async (ref) => {
    try { await loadMediaFile(ref); } catch { /* skip missing */ }
  }));

  // Replace refs with data URLs
  const modified = svgText.replace(
    /(<image[^>]+)((?:xlink:href|href)=")([^"]+)(")/gi,
    (_m, tag, attr, src, close) => {
      const url = mediaCache.get(src);
      return url ? `${tag}${attr}${url}${close}` : `${tag}${attr}${src}${close}`;
    }
  );

  // Re-encode as base64 data URL (handle UTF-8 safely)
  const bytes = new TextEncoder().encode(modified);
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return `data:image/svg+xml;base64,${btoa(bin)}`;
}

async function loadMediaFile(filename: string): Promise<string> {
  const hit = mediaCache.get(filename);
  if (hit) return hit;
  const dataUrl = await invoke<string>("anki_get_media_file", { filename });

  const isSvg = filename.toLowerCase().endsWith(".svg");
  console.log("[loadMedia]", filename, "→ isSvg:", isSvg, "dataUrl prefix:", dataUrl.slice(0, 40));

  // SVGs may reference other local files — inline them so the image renders when used as <img>
  const resolved = isSvg
    ? await inlineSvgImages(dataUrl)
    : dataUrl;

  mediaCache.set(filename, resolved);
  return resolved;
}

// Extract local media filenames from HTML (img src + SVG image href)
function extractLocalSrcs(html: string): string[] {
  const results: string[] = [];
  const isLocal = (s: string) =>
    !s.startsWith("http") && !s.startsWith("data:") && !s.startsWith("blob:");

  // <img src="...">
  const imgRe = /<img[^>]+\bsrc="([^"]+)"/gi;
  let m: RegExpExecArray | null;
  // eslint-disable-next-line no-cond-assign
  while ((m = imgRe.exec(html)) !== null) {
    if (isLocal(m[1])) results.push(m[1]);
  }

  // SVG <image href="..."> and <image xlink:href="...">
  const svgRe = /<image[^>]+(?:xlink:href|href)="([^"]+)"/gi;
  // eslint-disable-next-line no-cond-assign
  while ((m = svgRe.exec(html)) !== null) {
    if (isLocal(m[1])) results.push(m[1]);
  }

  return [...new Set(results)];
}

// Strip audio tags, load local images/SVG-images as data URLs, then sanitize
async function processHtml(raw: string, label = ""): Promise<string> {
  let html = raw.replace(/\[sound:[^\]]+\]/gi, "");

  const filenames = extractLocalSrcs(html);
  console.log(`[AnkiHtml${label}] raw length=${raw.length}, local srcs found:`, filenames);

  if (filenames.length > 0) {
    await Promise.all(
      filenames.map(async (fn) => {
        try {
          await loadMediaFile(fn);
          console.log(`[AnkiHtml${label}] loaded media:`, fn);
        } catch (e) {
          console.warn(`[AnkiHtml${label}] failed to load media:`, fn, e);
        }
      })
    );

    // Replace <img src="local"> with data URL
    html = html.replace(/(<img[^>]+\bsrc=")([^"]+)(")/gi, (_m, pre, src, post) => {
      const dataUrl = mediaCache.get(src);
      return dataUrl ? `${pre}${dataUrl}${post}` : `${pre}${src}${post}`;
    });

    // Replace SVG <image href="local"> and <image xlink:href="local"> with data URLs
    html = html.replace(/(<image[^>]+)((?:xlink:href|href)=")([^"]+)(")/gi, (_m, tag, attr, src, close) => {
      const dataUrl = mediaCache.get(src);
      return dataUrl ? `${tag}${attr}${dataUrl}${close}` : `${tag}${attr}${src}${close}`;
    });
  }

  // DOMPurify strips <style> blocks even with ADD_TAGS — extract them first,
  // sanitize the HTML body, then re-inject. Content is from the user's own Anki.
  const styleBlocks: string[] = [];
  html = html.replace(/<style>[\s\S]*?<\/style>/gi, (m) => { styleBlocks.push(m); return ""; });

  const beforeSanitize = html;
  // Sanitize — allow SVG (for image occlusion) + data: URIs
  const sanitized = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true, svg: true, svgFilters: true },
    ADD_ATTR: ["xlink:href", "tabindex", "viewBox", "preserveAspectRatio"],
    ALLOWED_URI_REGEXP:
      /^(?:(?:https?|ftp|blob|data):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
  });

  if (beforeSanitize.length !== sanitized.length) {
    console.log(`[AnkiHtml${label}] DOMPurify stripped ${beforeSanitize.length - sanitized.length} chars`);
  }
  const result = styleBlocks.join("") + sanitized;
  console.log(`[AnkiHtml${label}] style blocks: ${styleBlocks.length}, final HTML (first 1500):`, result.slice(0, 1500));

  return result;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAnkiCardHtml(rawQuestion: string, rawAnswer: string, cardId: number) {
  const [questionHtml, setQuestionHtml] = useState("");
  const [answerHtml, setAnswerHtml] = useState("");
  const [loading, setLoading] = useState(true);
  const currentId = useRef(cardId);

  useEffect(() => {
    currentId.current = cardId;
    setLoading(true);

    console.log(`[AnkiHtml] card ${cardId} — rawQuestion (first 300):`, rawQuestion.slice(0, 300));
    Promise.all([processHtml(rawQuestion, " Q"), processHtml(rawAnswer, " A")]).then(([q, a]) => {
      if (currentId.current !== cardId) return; // stale — discard
      setQuestionHtml(q);
      setAnswerHtml(a);
      setLoading(false);
    });
  }, [cardId, rawQuestion, rawAnswer]);

  return { questionHtml, answerHtml, loading };
}
