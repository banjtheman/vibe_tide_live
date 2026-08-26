import { encodeLevel, type LevelDocument } from "./core";

export const VIBETIDE_PUBLIC_URL = "https://vibetide-live.banjtheman.chatgpt.site/";

export interface SharedLevelRequest {
  levelCode: string | null;
  mode: "edit" | "play";
}

/** Builds a self-contained public link that opens the encoded level in Play mode. */
export function createPlayableShareUrl(
  level: LevelDocument,
  baseUrl: string | URL = VIBETIDE_PUBLIC_URL,
): string {
  const url = new URL(baseUrl.toString());
  url.search = "";
  url.hash = "";
  url.searchParams.set("level", encodeLevel(level));
  url.searchParams.set("mode", "play");
  return url.toString();
}

/** Reads current and legacy query/hash share links without throwing on bad URLs. */
export function parseSharedLevelUrl(input: string | URL): SharedLevelRequest {
  let url: URL;
  try {
    url = new URL(input.toString(), VIBETIDE_PUBLIC_URL);
  } catch {
    return { levelCode: null, mode: "edit" };
  }

  const hashParams = new URLSearchParams(url.hash.replace(/^#\??/, ""));
  const levelCode = url.searchParams.get("level") || hashParams.get("level");
  const requestedMode = url.searchParams.get("mode") || hashParams.get("mode");
  return {
    levelCode,
    mode: requestedMode === "play" ? "play" : "edit",
  };
}

export function shouldAutoStartSharedLevel(
  request: SharedLevelRequest,
  decodedSuccessfully: boolean,
  levelIsValid: boolean,
): boolean {
  return request.levelCode !== null && request.mode === "play" && decodedSuccessfully && levelIsValid;
}
