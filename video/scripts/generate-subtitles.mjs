import {mkdirSync, readFileSync, writeFileSync} from "node:fs";
import {dirname, resolve} from "node:path";

const manifestPath = resolve("public/voiceover/manifest.json");
const outputPath = resolve(
  process.argv[2] ?? "out/vibetide-webmcp-challenge.srt",
);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

const MAX_PAGE_MS = 1700;
const MAX_PAGE_CHARACTERS = 52;

const formatTimestamp = (milliseconds) => {
  const total = Math.max(0, Math.round(milliseconds));
  const hours = Math.floor(total / 3_600_000);
  const minutes = Math.floor((total % 3_600_000) / 60_000);
  const seconds = Math.floor((total % 60_000) / 1000);
  const millis = total % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")},${String(millis).padStart(3, "0")}`;
};

const pages = [];
let sceneOffsetMs = 0;

for (const scene of manifest.scenes) {
  let page = [];

  const flush = () => {
    if (page.length === 0) return;
    pages.push({
      startMs: sceneOffsetMs + page[0].startMs,
      endMs: sceneOffsetMs + page.at(-1).endMs,
      text: page
        .map((caption) => caption.text.trim().replaceAll("--", "—"))
        .join(" "),
    });
    page = [];
  };

  for (const caption of scene.captions) {
    const nextText = [...page, caption]
      .map((item) => item.text.trim())
      .join(" ");
    const nextDuration =
      page.length === 0 ? 0 : caption.endMs - page[0].startMs;

    if (
      page.length > 0 &&
      (nextDuration > MAX_PAGE_MS || nextText.length > MAX_PAGE_CHARACTERS)
    ) {
      flush();
    }

    page.push(caption);
  }

  flush();
  sceneOffsetMs += (scene.durationFrames / manifest.fps) * 1000;
}

const srt = pages
  .map(
    (page, index) =>
      `${index + 1}\n${formatTimestamp(page.startMs)} --> ${formatTimestamp(page.endMs)}\n${page.text}`,
  )
  .join("\n\n");

mkdirSync(dirname(outputPath), {recursive: true});
writeFileSync(outputPath, `${srt}\n`, "utf8");
console.log(`Wrote ${pages.length} subtitle cues to ${outputPath}`);
