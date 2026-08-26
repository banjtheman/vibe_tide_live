import { describe, expect, it } from "vitest";

import { generateLevel } from "../src/core";
import {
  createLevelPageSeo,
  renderSeoHead,
  replaceSeoHead,
  ROOT_PAGE_SEO,
  SEO_BLOCK_END,
  SEO_BLOCK_START,
  VIBETIDE_SITE_URL,
  VIBETIDE_SOCIAL_IMAGE_URL,
} from "../src/seo";

describe("SEO and social sharing metadata", () => {
  it("renders a complete root social card and crawler policy", () => {
    const head = renderSeoHead(ROOT_PAGE_SEO);

    expect(head).toContain('content="summary_large_image"');
    expect(head).toContain('property="og:image:type" content="image/png"');
    expect(head).toContain('property="og:image:width" content="1200"');
    expect(head).toContain('property="og:image:height" content="630"');
    expect(head).toContain(VIBETIDE_SOCIAL_IMAGE_URL);
    expect(head).toContain('content="index, follow, max-image-preview:large"');
    expect(head).toContain('type="application/ld+json"');
  });

  it("creates level-specific preview copy while keeping search canonical at the game", () => {
    const level = generateLevel({
      name: "Pearlstorm Passage",
      description: "A bright sprint across the reef.",
      seed: 42,
    });
    const seo = createLevelPageSeo(
      level,
      "https://untrusted.example/path?level=vt1.safe-code&mode=play&tracking=drop-me",
    );

    expect(seo.title).toBe("Pearlstorm Passage — VibeTide Live");
    expect(seo.description).toContain("A bright sprint across the reef.");
    expect(seo.canonicalUrl).toBe(VIBETIDE_SITE_URL);
    expect(seo.pageUrl).toBe(`${VIBETIDE_SITE_URL}?level=vt1.safe-code&mode=play`);
    expect(seo.robots).toContain("noindex");
  });

  it("escapes user-authored metadata before inserting it into HTML", () => {
    const generated = generateLevel({ name: "Safe", seed: 7 });
    const level = {
      ...generated,
      metadata: {
        ...generated.metadata,
        name: '<img src=x onerror="alert(1)">',
        description: "</script><script>alert(1)</script>",
      },
    };
    const rendered = renderSeoHead(
      createLevelPageSeo(level, `${VIBETIDE_SITE_URL}?level=vt1.code&mode=play`),
    );

    expect(rendered).not.toContain('<img src=x onerror="alert(1)">');
    expect(rendered).not.toContain("</script><script>alert(1)</script>");
    expect(rendered).toContain("&lt;img");
    expect(rendered).toContain("\\u003c/script\\u003e");
  });

  it("replaces only the marked SEO block", () => {
    const source = `<head>${SEO_BLOCK_START}<title>Old</title>${SEO_BLOCK_END}<meta name="keep" /></head>`;
    const replaced = replaceSeoHead(source, ROOT_PAGE_SEO);

    expect(replaced).toContain("VibeTide Live — Play. Build. Share.");
    expect(replaced).toContain('<meta name="keep" />');
    expect(replaced.match(/VIBETIDE_SEO_START/g)).toHaveLength(1);
  });
});
