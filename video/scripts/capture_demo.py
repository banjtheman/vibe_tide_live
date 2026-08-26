#!/usr/bin/env python
"""Capture deterministic VibeTide demo footage for the Remotion film.

The injected modelContext is a small test host. It does not mock VibeTide's
tools: the page registers its production WebMCP tool definitions and this
script invokes those registered execute handlers exactly as a host would.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import time
from pathlib import Path
from typing import Any, Callable

from playwright.sync_api import Browser, Page, sync_playwright


ROOT = Path(__file__).resolve().parents[2]
VIDEO_ROOT = ROOT / "video"
CAPTURE_ROOT = VIDEO_ROOT / "public" / "captures"
GENERATED_ROOT = VIDEO_ROOT / "src" / "generated"
BASE_URL = os.environ.get("VIBETIDE_CAPTURE_URL", "http://127.0.0.1:4173/")
CHROME_PATH = Path("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")

INIT_WEBMCP_HOST = """
window.__vtTools = {};
Object.defineProperty(document, "modelContext", {
  configurable: true,
  value: {
    registerTool: async (tool, options = {}) => {
      window.__vtTools[tool.name] = tool;
      options.signal?.addEventListener(
        "abort",
        () => delete window.__vtTools[tool.name],
        {once: true},
      );
    },
  },
});
window.localStorage.removeItem("vibe-tide-live:studio:v1");
"""

BLUEPRINT: dict[str, Any] = {
    "name": "Sunset Circuit",
    "description": "A moonlit route built live through WebMCP.",
    "width": 56,
    "height": 18,
    "difficulty": "moderate",
    "primary_mechanic": "mixed",
    "background": "neon-moonwave",
    "seed": 4242,
    "sections": [
        {"kind": "run", "length": 8, "intensity": 1},
        {"kind": "ice", "length": 8, "intensity": 2},
        {"kind": "spikes", "length": 6, "intensity": 1},
        {"kind": "water", "length": 7, "intensity": 2},
        {"kind": "stairs", "length": 7, "intensity": 2},
        {"kind": "finish", "length": 8, "intensity": 1},
    ],
}


def run(command: list[str]) -> str:
    result = subprocess.run(command, check=True, capture_output=True, text=True)
    return result.stdout.strip()


def media_duration(path: Path) -> float:
    value = run(
        [
            "ffprobe",
            "-v",
            "error",
            "-show_entries",
            "format=duration",
            "-of",
            "default=noprint_wrappers=1:nokey=1",
            str(path),
        ]
    )
    return float(value)


def invoke(page: Page, name: str, payload: dict[str, Any] | None = None) -> str:
    return page.evaluate(
        """async ({name, payload}) => {
          const tool = window.__vtTools?.[name];
          if (!tool) throw new Error(`Missing registered WebMCP tool: ${name}`);
          return await tool.execute(payload ?? {});
        }""",
        {"name": name, "payload": payload or {}},
    )


def wait_until_ready(page: Page) -> None:
    page.goto(BASE_URL, wait_until="networkidle")
    page.wait_for_function("Object.keys(window.__vtTools || {}).length === 10")
    page.wait_for_selector("[data-stage]")
    page.wait_for_timeout(900)


def create_sunset_circuit(page: Page) -> None:
    result = invoke(page, "create_level_from_blueprint", BLUEPRINT)
    if "Created level" not in result:
        raise RuntimeError(f"Unexpected create result: {result}")
    validation = json.loads(invoke(page, "validate_level"))
    if not validation.get("valid"):
        raise RuntimeError(f"Generated level is invalid: {validation}")


def drive_otter(page: Page, *, seconds: float, jump: bool) -> None:
    page.locator("canvas").click(position={"x": 420, "y": 380})
    page.keyboard.down("ArrowRight")
    started = time.monotonic()
    next_jump = started + 0.45
    while time.monotonic() - started < seconds:
        now = time.monotonic()
        if jump and now >= next_jump:
            page.keyboard.press("Space")
            next_jump = now + 1.15
        page.wait_for_timeout(90)
    page.keyboard.up("ArrowRight")


def capture_clip(
    browser: Browser,
    name: str,
    action: Callable[[Page, Callable[[str], None]], None],
    *,
    viewport: tuple[int, int] = (1920, 1080),
) -> dict[str, Any]:
    take_dir = CAPTURE_ROOT / f".{name}-take"
    if take_dir.exists():
        shutil.rmtree(take_dir)
    take_dir.mkdir(parents=True)

    width, height = viewport
    context = browser.new_context(
        viewport={"width": width, "height": height},
        device_scale_factor=1,
        record_video_dir=str(take_dir),
        record_video_size={"width": width, "height": height},
    )
    page = context.new_page()
    page.add_init_script(INIT_WEBMCP_HOST)
    started = time.monotonic()
    markers: dict[str, float] = {}

    def mark(label: str) -> None:
        markers[label] = round(time.monotonic() - started, 3)

    wait_until_ready(page)
    mark("ready")
    action(page, mark)
    page.screenshot(path=str(CAPTURE_ROOT / f"{name}-final.png"))
    video = page.video
    if video is None:
        raise RuntimeError(f"Playwright did not create video for {name}")
    context.close()

    raw_path = take_dir / f"{name}.webm"
    video.save_as(str(raw_path))
    output_path = CAPTURE_ROOT / f"{name}.mp4"
    run(
        [
            "ffmpeg",
            "-y",
            "-loglevel",
            "error",
            "-i",
            str(raw_path),
            "-an",
            "-c:v",
            "libx264",
            "-preset",
            "medium",
            "-crf",
            "20",
            "-r",
            "30",
            "-pix_fmt",
            "yuv420p",
            "-movflags",
            "+faststart",
            str(output_path),
        ]
    )
    duration = round(media_duration(output_path), 3)
    shutil.rmtree(take_dir)
    return {
        "file": f"captures/{output_path.name}",
        "width": width,
        "height": height,
        "durationSeconds": duration,
        "markers": markers,
    }


def human_build(page: Page, mark: Callable[[str], None]) -> None:
    page.wait_for_timeout(900)
    mark("edit_name")
    name = page.locator('[data-field="name"]')
    name.fill("Coral Rush")
    name.press("Tab")
    page.wait_for_timeout(650)
    mark("choose_world")
    page.locator('[data-background="bioluminescent-grotto"]').click()
    page.wait_for_timeout(900)
    page.locator('[data-field="difficulty"]').select_option("tricky")
    page.locator('[data-field="primaryMechanic"]').select_option("mixed")
    page.wait_for_timeout(700)
    mark("generate")
    page.locator('[data-action="fresh"]').click()
    page.wait_for_timeout(1700)
    mark("paint")
    page.locator('[data-brush="4"]').click()
    for x in (12, 13, 14, 15):
        page.locator(f'.level-cell[data-x="{x}"][data-y="14"]').click()
        page.wait_for_timeout(160)
    page.wait_for_timeout(1600)


def agent_loop(page: Page, mark: Callable[[str], None]) -> None:
    page.wait_for_timeout(1000)
    mark("prompt")
    page.wait_for_timeout(1700)
    mark("create")
    create_sunset_circuit(page)
    page.wait_for_timeout(2600)
    mark("patch")
    invoke(
        page,
        "apply_level_patch",
        {
            "reason": "Add a short sea-glass rhythm and a ranged encounter.",
            "operations": [
                {"kind": "platform", "x": 20, "y": 14, "length": 5, "tile": 4},
                {"kind": "set_tile", "x": 23, "y": 13, "tile": 10},
            ],
        },
    )
    page.wait_for_timeout(2100)
    mark("validate")
    validation = json.loads(invoke(page, "validate_level"))
    if not validation.get("valid"):
        raise RuntimeError(f"Patched level is invalid: {validation}")
    page.wait_for_timeout(1500)
    mark("play")
    invoke(page, "start_playtest")
    page.wait_for_timeout(1100)
    drive_otter(page, seconds=6.8, jump=False)
    mark("report")
    report_text = invoke(page, "get_playtest_report")
    report = json.loads(report_text) if report_text.startswith("{") else {}
    page.wait_for_timeout(1300)
    page.locator('[data-action="play"]').click()
    page.wait_for_timeout(800)

    cluster = (report.get("death_clusters") or [{}])[0].get("center") or {"x": 15, "y": 15}
    repair_x = max(2, min(51, int(cluster.get("x", 15)) - 1))
    repair_y = max(3, min(16, int(cluster.get("y", 15))))
    mark("repair")
    invoke(
        page,
        "apply_level_patch",
        {
            "reason": "Repair the first playtest trouble spot without replacing the level.",
            "operations": [
                {"kind": "platform", "x": repair_x, "y": repair_y, "length": 3, "tile": 1}
            ],
        },
    )
    page.wait_for_timeout(2200)
    mark("revalidate")
    validation = json.loads(invoke(page, "validate_level"))
    if not validation.get("valid"):
        raise RuntimeError(f"Repaired level is invalid: {validation}")
    page.wait_for_timeout(1600)


def gameplay(page: Page, mark: Callable[[str], None]) -> None:
    create_sunset_circuit(page)
    invoke(page, "start_playtest")
    page.wait_for_timeout(1200)
    mark("gameplay")
    drive_otter(page, seconds=10.5, jump=True)
    page.wait_for_timeout(900)


def share_roundtrip(page: Page, mark: Callable[[str], None]) -> None:
    create_sunset_circuit(page)
    page.wait_for_timeout(1000)
    mark("share")
    result = invoke(page, "create_share_link")
    share_url = result.split(": ", 1)[1]
    page.locator('[data-action="share"]').first.click()
    page.wait_for_timeout(1800)
    mark("open_link")
    page.goto(share_url, wait_until="networkidle")
    page.wait_for_timeout(2100)
    mark("shared_play")
    drive_otter(page, seconds=4.5, jump=True)


def mobile_play(page: Page, mark: Callable[[str], None]) -> None:
    create_sunset_circuit(page)
    invoke(page, "start_playtest")
    page.wait_for_timeout(1000)
    mark("mobile_play")
    right = page.locator('[data-control="right"]')
    jump = page.locator('[data-control="jump"]')
    right.dispatch_event("pointerdown", {"pointerId": 1, "button": 0})
    for _ in range(5):
        page.wait_for_timeout(650)
        jump.dispatch_event("pointerdown", {"pointerId": 2, "button": 0})
        jump.dispatch_event("pointerup", {"pointerId": 2, "button": 0})
    right.dispatch_event("pointerup", {"pointerId": 1, "button": 0})
    page.wait_for_timeout(1000)


def write_manifest(captures: dict[str, dict[str, Any]]) -> None:
    CAPTURE_ROOT.mkdir(parents=True, exist_ok=True)
    GENERATED_ROOT.mkdir(parents=True, exist_ok=True)
    json_path = CAPTURE_ROOT / "manifest.json"
    json_path.write_text(json.dumps(captures, indent=2) + "\n", encoding="utf-8")
    ts_path = GENERATED_ROOT / "capture-manifest.ts"
    ts_path.write_text(
        "// Generated by scripts/capture_demo.py.\n"
        f"export const CAPTURE_MANIFEST = {json.dumps(captures, indent=2)} as const;\n",
        encoding="utf-8",
    )


def main() -> None:
    CAPTURE_ROOT.mkdir(parents=True, exist_ok=True)
    launch_options: dict[str, Any] = {"headless": True}
    if CHROME_PATH.exists():
        launch_options["executable_path"] = str(CHROME_PATH)

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(**launch_options)
        try:
            captures = {
                "humanBuild": capture_clip(browser, "human-build", human_build),
                "agentLoop": capture_clip(browser, "agent-loop", agent_loop),
                "gameplay": capture_clip(browser, "gameplay", gameplay),
                "share": capture_clip(browser, "share-roundtrip", share_roundtrip),
                "mobile": capture_clip(
                    browser,
                    "mobile-play",
                    mobile_play,
                    viewport=(540, 960),
                ),
            }
        finally:
            browser.close()

    write_manifest(captures)
    print(json.dumps(captures, indent=2))


if __name__ == "__main__":
    main()
