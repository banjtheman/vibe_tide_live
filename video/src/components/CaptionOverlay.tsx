import {createTikTokStyleCaptions} from "@remotion/captions";
import type {Caption} from "@remotion/captions";
import {useMemo} from "react";
import {interpolate, useCurrentFrame, useVideoConfig} from "remotion";

type CaptionOverlayProps = {
  captions: readonly Caption[];
};

const PAGE_MS = 1350;

export const CaptionOverlay: React.FC<CaptionOverlayProps> = ({captions}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const currentMs = (frame / fps) * 1000;
  const {pages} = useMemo(
    () =>
      createTikTokStyleCaptions({
        // ElevenLabs returns word tokens without a leading space after the
        // first token. Remotion uses that space as a safe page-break boundary,
        // so normalize every spoken word before grouping it into short pages.
        captions: captions.map((caption) => ({
          ...caption,
          text: ` ${caption.text.trim().replaceAll("--", "—")}`,
        })),
        combineTokensWithinMilliseconds: PAGE_MS,
      }),
    [captions],
  );
  const pageIndex = pages.findIndex(
    (page) =>
      currentMs >= page.startMs && currentMs < page.startMs + page.durationMs,
  );
  const page = pages[pageIndex];
  if (!page) return null;

  const pageAge = currentMs - page.startMs;
  const fadeOutStart = Math.max(110, page.durationMs - 120);
  const opacity = interpolate(
    pageAge,
    [0, 110, fadeOutStart, page.durationMs],
    [0, 1, 1, 0],
    {extrapolateLeft: "clamp", extrapolateRight: "clamp"},
  );

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 28,
        zIndex: 40,
        display: "flex",
        justifyContent: "center",
        pointerEvents: "none",
        opacity,
      }}
    >
      <div
        style={{
          maxWidth: 1420,
          minHeight: 68,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "13px 30px 15px",
          borderRadius: 24,
          color: "white",
          background: "rgba(5, 13, 28, 0.9)",
          border: "1px solid rgba(160, 232, 245, 0.24)",
          boxShadow: "0 16px 48px rgba(0, 0, 0, 0.34)",
          fontFamily: "IBM Plex Sans, sans-serif",
          fontWeight: 650,
          fontSize: 34,
          lineHeight: 1.18,
          textAlign: "center",
          whiteSpace: "pre-wrap",
          letterSpacing: -0.3,
        }}
      >
        {page.tokens.map((token) => {
          const active = token.fromMs <= currentMs && token.toMs > currentMs;
          return (
            <span
              key={`${token.fromMs}-${token.text}`}
              style={{
                color: active ? "#79e9f7" : "#f7f3ec",
                textShadow: active
                  ? "0 0 20px rgba(58, 221, 242, 0.35)"
                  : undefined,
              }}
            >
              {token.text}
            </span>
          );
        })}
      </div>
    </div>
  );
};
