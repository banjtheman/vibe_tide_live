import {mkdir} from "node:fs/promises";
import {spawnSync} from "node:child_process";
import {resolve} from "node:path";

const output = resolve(import.meta.dirname, "..", "public", "audio", "vibetide-bed.mp3");
await mkdir(resolve(import.meta.dirname, "..", "public", "audio"), {recursive: true});

const expression = [
  "0.055*sin(2*PI*55*t)",
  "0.030*sin(2*PI*82.407*t)*(0.62+0.38*sin(2*PI*0.047*t))",
  "0.020*sin(2*PI*110*t)*(0.58+0.42*sin(2*PI*0.071*t+1.4))",
  "0.012*sin(2*PI*164.814*t)*(0.5+0.5*sin(2*PI*0.033*t+2.1))",
].join("+");

const result = spawnSync(
  "ffmpeg",
  [
    "-y",
    "-loglevel",
    "error",
    "-f",
    "lavfi",
    "-i",
    `aevalsrc=${expression}:s=48000:d=180`,
    "-af",
    "lowpass=f=1800,aecho=0.8:0.72:240|480:0.18|0.1,afade=t=in:st=0:d=2,afade=t=out:st=176:d=4,loudnorm=I=-27:TP=-3:LRA=5",
    "-c:a",
    "libmp3lame",
    "-b:a",
    "192k",
    output,
  ],
  {stdio: "inherit"},
);

if (result.status !== 0) {
  throw new Error(`ffmpeg exited with status ${result.status}`);
}
console.log(`Generated original ambient bed: ${output}`);
