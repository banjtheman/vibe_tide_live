import {spawnSync} from "node:child_process";
import {mkdirSync} from "node:fs";
import {dirname, resolve} from "node:path";

const input = resolve(process.argv[2] ?? "out/vibetide-webmcp-challenge.raw.mp4");
const output = resolve(process.argv[3] ?? "out/vibetide-webmcp-challenge.mp4");

mkdirSync(dirname(output), {recursive: true});

const result = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-i",
    input,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0",
    "-c:v",
    "copy",
    "-af",
    "loudnorm=I=-16:TP=-1.5:LRA=11",
    "-c:a",
    "aac",
    "-ar",
    "48000",
    "-b:a",
    "256k",
    "-movflags",
    "+faststart",
    output,
  ],
  {stdio: "inherit"},
);

if (result.error) {
  throw result.error;
}

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}
