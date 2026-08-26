# VibeTide Live competition video

This directory contains the Remotion source for the WebMCP Challenge demo film.
The finished cut is 1920 × 1080, 30 fps, fully captioned, and approximately
2 minutes 16 seconds long.

## What is real in the demo

- The gameplay, builder, mobile controls, and share round-trip are captured from
  the running VibeTide Live app.
- The WebMCP capture installs a small test host before page load, waits for all
  ten production tools to register, and invokes their real `execute` handlers.
- The agent sequence creates and validates **Sunset Circuit**, starts a playtest,
  reads its death clusters, applies one targeted repair, and validates again.
- The on-screen Codex request and tool-call rail are editorial overlays around
  those genuine page-tool effects; they are not presented as a recording of the
  ChatGPT interface.

## Reproduce

```bash
# Terminal 1, from the repository root
npm run dev -- --port 4173

# Terminal 2
cd video
npm install
python -m pip install -r requirements.txt
python -m playwright install chromium
npm run capture

# Load ELEVENLABS_API_KEY in the environment, then:
npm run voiceover
npm run music
npm run check
npm run render
```

The ElevenLabs key is used only by `scripts/generate-voiceover.ts`. It is never
written into this project. The checked-in narration was generated scene by scene
with the premade **Jessica — Playful, Bright, Warm** voice.

`npm run render` creates a full-resolution H.264/AAC master, then normalizes the
audio to approximately -16 LUFS with a -1.5 dB true-peak ceiling. FFmpeg must be
available on the machine for the mastering step.

Output is written to `video/out/vibetide-webmcp-challenge.mp4`.

Generate the rest of the upload kit with:

```bash
npm run package
```

That produces a YouTube thumbnail and an English SRT subtitle track in
`video/out`. Suggested upload copy and the final checklist are in
[SUBMISSION.md](SUBMISSION.md).
