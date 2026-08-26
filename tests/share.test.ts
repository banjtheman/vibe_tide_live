import { describe, expect, it } from "vitest";

import { decodeLevel, generateLevel } from "../src/core";
import {
  createPlayableShareUrl,
  parseSharedLevelUrl,
  shouldAutoStartSharedLevel,
} from "../src/share";

describe("playable level sharing", () => {
  const level = generateLevel({
    name: "Share the tide",
    description: "A level that travels inside its URL.",
    seed: 8262026,
  });

  it("creates a self-contained play link and removes stale URL state", () => {
    const shareUrl = createPlayableShareUrl(
      level,
      "https://example.test/studio?draft=old#level=stale",
    );
    const parsed = new URL(shareUrl);

    expect(parsed.origin).toBe("https://example.test");
    expect(parsed.pathname).toBe("/studio");
    expect(parsed.searchParams.get("draft")).toBeNull();
    expect(parsed.searchParams.get("mode")).toBe("play");
    expect(parsed.hash).toBe("");
    expect(decodeLevel(shareUrl)).toEqual(level);
  });

  it("parses both current query links and legacy hash links", () => {
    const current = createPlayableShareUrl(level, "https://example.test/");
    const code = new URL(current).searchParams.get("level");

    expect(parseSharedLevelUrl(current)).toEqual({ levelCode: code, mode: "play" });
    expect(parseSharedLevelUrl(`https://example.test/#level=${code}`)).toEqual({
      levelCode: code,
      mode: "edit",
    });
    expect(parseSharedLevelUrl(`https://example.test/#level=${code}&mode=play`)).toEqual({
      levelCode: code,
      mode: "play",
    });
  });

  it("keeps old and unknown modes editable", () => {
    expect(parseSharedLevelUrl("https://example.test/?level=vt1.AAAA").mode).toBe("edit");
    expect(parseSharedLevelUrl("https://example.test/?level=vt1.AAAA&mode=preview").mode).toBe("edit");
    expect(parseSharedLevelUrl("not a valid URL")).toEqual({ levelCode: null, mode: "edit" });
  });

  it("only auto-starts a decoded, valid playable share", () => {
    const request = { levelCode: "vt1.AAAA", mode: "play" as const };
    expect(shouldAutoStartSharedLevel(request, true, true)).toBe(true);
    expect(shouldAutoStartSharedLevel(request, false, true)).toBe(false);
    expect(shouldAutoStartSharedLevel(request, true, false)).toBe(false);
    expect(shouldAutoStartSharedLevel({ ...request, mode: "edit" }, true, true)).toBe(false);
  });
});
