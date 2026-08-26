import type { LevelDocument } from "./core";

export const VIBETIDE_SITE_URL = "https://vibetide-live.banjtheman.chatgpt.site/";
export const VIBETIDE_SOCIAL_IMAGE_URL = `${VIBETIDE_SITE_URL}og-v1.png`;
export const SEO_BLOCK_START = "<!-- VIBETIDE_SEO_START -->";
export const SEO_BLOCK_END = "<!-- VIBETIDE_SEO_END -->";

const ROOT_TITLE = "VibeTide Live — Play. Build. Share.";
const ROOT_DESCRIPTION =
  "Build beachy 2D platformer levels, play them instantly, and share every adventure with one link.";
const SOCIAL_IMAGE_ALT =
  "VibeTide Live headphone-wearing otter landing on colorful ocean platforms";

export interface PageSeo {
  kind: "root" | "level";
  title: string;
  description: string;
  canonicalUrl: string;
  pageUrl: string;
  robots: string;
}

export const ROOT_PAGE_SEO: PageSeo = Object.freeze({
  kind: "root",
  title: ROOT_TITLE,
  description: ROOT_DESCRIPTION,
  canonicalUrl: VIBETIDE_SITE_URL,
  pageUrl: VIBETIDE_SITE_URL,
  robots: "index, follow, max-image-preview:large",
});

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function truncateAtWord(value: string, maximumLength: number): string {
  const normalized = normalizeText(value);
  if (normalized.length <= maximumLength) return normalized;
  const slice = normalized.slice(0, Math.max(1, maximumLength - 1));
  const lastSpace = slice.lastIndexOf(" ");
  const end = lastSpace >= Math.floor(maximumLength * 0.6) ? slice.slice(0, lastSpace) : slice;
  return `${end.trimEnd()}…`;
}

function trustedLevelUrl(input: string | URL): string {
  const output = new URL(VIBETIDE_SITE_URL);
  try {
    const candidate = new URL(input.toString(), VIBETIDE_SITE_URL);
    const level = candidate.searchParams.get("level");
    if (level) output.searchParams.set("level", level);
    if (candidate.searchParams.get("mode") === "play") output.searchParams.set("mode", "play");
  } catch {
    // Keep the trusted public root when an input URL is malformed.
  }
  return output.toString();
}

export function createLevelPageSeo(level: LevelDocument, requestUrl: string | URL): PageSeo {
  const name = normalizeText(level.metadata.name) || "Shared level";
  const titleSuffix = " — VibeTide Live";
  const title = `${truncateAtWord(name, 64 - titleSuffix.length)}${titleSuffix}`;
  const levelDescription = normalizeText(level.metadata.description);
  const description = truncateAtWord(
    levelDescription
      ? `${levelDescription} Play this VibeTide level instantly, then remix it in the builder.`
      : `Play ${name}, a ${level.metadata.difficulty} VibeTide platformer level, then remix it in the builder.`,
    160,
  );

  return {
    kind: "level",
    title,
    description,
    canonicalUrl: VIBETIDE_SITE_URL,
    pageUrl: trustedLevelUrl(requestUrl),
    robots: "noindex, follow, max-image-preview:large",
  };
}

function escapeAttribute(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function structuredDataFor(seo: PageSeo): Record<string, unknown> {
  const game = {
    "@type": ["VideoGame", "WebApplication"],
    name: "VibeTide Live",
    url: VIBETIDE_SITE_URL,
    image: VIBETIDE_SOCIAL_IMAGE_URL,
    description: ROOT_DESCRIPTION,
    applicationCategory: "GameApplication",
    operatingSystem: "Any",
    gamePlatform: "Web browser",
    genre: ["Platformer", "Level editor"],
    playMode: "SinglePlayer",
    isAccessibleForFree: true,
  };

  if (seo.kind === "root") {
    return { "@context": "https://schema.org", ...game };
  }

  return {
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: seo.title,
    description: seo.description,
    url: seo.pageUrl,
    isPartOf: game,
  };
}

function safeStructuredData(seo: PageSeo): string {
  return JSON.stringify(structuredDataFor(seo))
    .replaceAll("<", "\\u003c")
    .replaceAll(">", "\\u003e")
    .replaceAll("&", "\\u0026");
}

export function renderSeoHead(seo: PageSeo): string {
  const title = escapeAttribute(seo.title);
  const description = escapeAttribute(seo.description);
  const canonicalUrl = escapeAttribute(seo.canonicalUrl);
  const pageUrl = escapeAttribute(seo.pageUrl);
  const robots = escapeAttribute(seo.robots);

  return `${SEO_BLOCK_START}
    <title>${title}</title>
    <link rel="canonical" href="${canonicalUrl}" />
    <meta name="description" content="${description}" />
    <meta name="robots" content="${robots}" />
    <meta property="og:type" content="website" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:site_name" content="VibeTide Live" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${pageUrl}" />
    <meta property="og:image" content="${VIBETIDE_SOCIAL_IMAGE_URL}" />
    <meta property="og:image:secure_url" content="${VIBETIDE_SOCIAL_IMAGE_URL}" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="${SOCIAL_IMAGE_ALT}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:url" content="${pageUrl}" />
    <meta name="twitter:image" content="${VIBETIDE_SOCIAL_IMAGE_URL}" />
    <meta name="twitter:image:alt" content="${SOCIAL_IMAGE_ALT}" />
    <script id="vibetide-structured-data" type="application/ld+json">${safeStructuredData(seo)}</script>
    ${SEO_BLOCK_END}`;
}

export function replaceSeoHead(html: string, seo: PageSeo): string {
  const start = html.indexOf(SEO_BLOCK_START);
  const end = html.indexOf(SEO_BLOCK_END, start + SEO_BLOCK_START.length);
  if (start < 0 || end < 0) return html;
  return `${html.slice(0, start)}${renderSeoHead(seo)}${html.slice(end + SEO_BLOCK_END.length)}`;
}

function setMetaContent(documentRef: Document, selector: string, value: string): void {
  documentRef.querySelector<HTMLMetaElement>(selector)?.setAttribute("content", value);
}

export function applyDocumentSeo(seo: PageSeo, documentRef: Document = document): void {
  documentRef.title = seo.title;
  documentRef.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.setAttribute("href", seo.canonicalUrl);
  setMetaContent(documentRef, 'meta[name="description"]', seo.description);
  setMetaContent(documentRef, 'meta[name="robots"]', seo.robots);
  setMetaContent(documentRef, 'meta[property="og:title"]', seo.title);
  setMetaContent(documentRef, 'meta[property="og:description"]', seo.description);
  setMetaContent(documentRef, 'meta[property="og:url"]', seo.pageUrl);
  setMetaContent(documentRef, 'meta[name="twitter:title"]', seo.title);
  setMetaContent(documentRef, 'meta[name="twitter:description"]', seo.description);
  setMetaContent(documentRef, 'meta[name="twitter:url"]', seo.pageUrl);
  const structuredData = documentRef.querySelector<HTMLScriptElement>("#vibetide-structured-data");
  if (structuredData) structuredData.textContent = safeStructuredData(seo);
}
