import type {CSSProperties, ReactNode} from "react";
import {Video} from "@remotion/media";
import {
  Easing,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type ChromeFrameProps = {
  file: string;
  startAtSeconds?: number;
  trimAfterSeconds?: number;
  loop?: boolean;
  style?: CSSProperties;
  videoStyle?: CSSProperties;
  url?: string;
  badge?: ReactNode;
};

export const ChromeFrame: React.FC<ChromeFrameProps> = ({
  file,
  startAtSeconds = 0,
  trimAfterSeconds,
  loop = true,
  style,
  videoStyle,
  url = "vibetide-live.banjtheman.chatgpt.site",
  badge,
}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const enter = interpolate(frame, [0, 20], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        borderRadius: 28,
        overflow: "hidden",
        border: "1px solid rgba(181, 238, 247, 0.24)",
        background: "#111722",
        boxShadow:
          "0 38px 90px rgba(1, 8, 20, 0.52), 0 0 0 1px rgba(255,255,255,0.05)",
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [34, 0])}px) scale(${interpolate(enter, [0, 1], [0.975, 1])})`,
        ...style,
      }}
    >
      <div
        style={{
          height: 50,
          background: "linear-gradient(180deg, #191b26, #11131c)",
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 18px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          color: "rgba(238,248,255,0.68)",
          fontSize: 16,
          fontFamily: "IBM Plex Sans, sans-serif",
        }}
      >
        {["#ff6b72", "#ffc861", "#5be0c4"].map((color) => (
          <span
            key={color}
            style={{width: 12, height: 12, borderRadius: 99, background: color}}
          />
        ))}
        <div
          style={{
            marginLeft: 10,
            height: 30,
            flex: 1,
            maxWidth: 660,
            borderRadius: 10,
            background: "rgba(255,255,255,0.055)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            letterSpacing: 0.1,
          }}
        >
          {url}
        </div>
        {badge ? <div style={{marginLeft: "auto"}}>{badge}</div> : null}
      </div>
      <div style={{position: "absolute", inset: "50px 0 0"}}>
        <Video
          src={staticFile(file)}
          muted
          loop={loop}
          objectFit="cover"
          trimBefore={Math.round(startAtSeconds * fps)}
          trimAfter={
            trimAfterSeconds === undefined
              ? undefined
              : Math.round(trimAfterSeconds * fps)
          }
          style={{
            width: "100%",
            height: "100%",
            objectPosition: "center top",
            ...videoStyle,
          }}
        />
      </div>
    </div>
  );
};
