import { copyFile, mkdir } from "node:fs/promises";

const workerSource = new URL("../server/index.js", import.meta.url);
const workerDirectory = new URL("../dist/server/", import.meta.url);
const workerOutput = new URL("index.js", workerDirectory);

await mkdir(workerDirectory, { recursive: true });
await copyFile(workerSource, workerOutput);
