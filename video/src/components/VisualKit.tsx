import type {CSSProperties, ReactNode} from "react";
import {Easing, Img, interpolate, staticFile, useCurrentFrame} from "remotion";

export const COLORS = {
  ink: "#07182d",
  deep: "#0a2340",
  navy: "#0d3150",
  cyan: "#44d8e9",
  mint: "#70e4c3",
  coral: "#ef5364",
  coralSoft: "#ff9b8e",
  violet: "#9a64e8",
  gold: "#ffc857",
  cream: "#fff2df",
  white: "#f7fbff",
  green: "#4aca92",
} as const;

export type Accent = "coral" | "cyan" | "violet" | "gold" | "green";

export const accentColor = (accent: Accent): string =>
  ({
    coral: COLORS.coral,
    cyan: COLORS.cyan,
    violet: COLORS.violet,
    gold: COLORS.gold,
    green: COLORS.green,
  })[accent];

export const OceanField: React.FC<{
  accent?: Accent;
  image?: string;
  children?: ReactNode;
}> = ({accent = "cyan", image, children}) => {
  const frame = useCurrentFrame();
  const color = accentColor(accent);
  const drift = Math.sin(frame / 54) * 26;
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: COLORS.ink,
      }}
    >
      {image ? (
        <Img
          src={staticFile(image)}
          style={{
            position: "absolute",
            inset: -40,
            width: 2000,
            height: 1160,
            objectFit: "cover",
            opacity: 0.42,
            filter: "saturate(1.1) contrast(1.08)",
            transform: `scale(1.06) translateX(${drift * 0.18}px)`,
          }}
        />
      ) : null}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: [
            `radial-gradient(circle at ${26 + drift * 0.03}% 24%, ${color}42, transparent 34%)`,
            "radial-gradient(circle at 78% 18%, rgba(114,93,226,0.28), transparent 31%)",
            "linear-gradient(155deg, rgba(4,17,35,0.54), rgba(5,17,36,0.92) 62%, #051224)",
          ].join(","),
        }}
      />
      {[0, 1, 2, 3, 4, 5].map((index) => {
        const x = 160 + index * 330 + Math.sin(frame / 43 + index) * 30;
        const y = 170 + ((index * 173) % 720) + Math.cos(frame / 52 + index) * 20;
        return (
          <div
            key={index}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 6 + (index % 3) * 5,
              height: 6 + (index % 3) * 5,
              borderRadius: 99,
              background: color,
              opacity: 0.12 + (index % 2) * 0.08,
              boxShadow: `0 0 26px ${color}`,
            }}
          />
        );
      })}
      {children}
    </div>
  );
};

export const WaveMark: React.FC<{size?: number}> = ({size = 58}) => (
  <div
    style={{
      width: size,
      height: size,
      borderRadius: size * 0.3,
      background: `linear-gradient(135deg, ${COLORS.coral}, #c43f67)`,
      display: "grid",
      placeItems: "center",
      color: "white",
      fontFamily: "Bricolage Grotesque, sans-serif",
      fontSize: size * 0.62,
      fontWeight: 800,
      boxShadow: "0 13px 36px rgba(239,83,100,0.3)",
    }}
  >
    ≈
  </div>
);

export const Brand: React.FC<{compact?: boolean}> = ({compact = false}) => (
  <div style={{display: "flex", alignItems: "center", gap: compact ? 13 : 18}}>
    <WaveMark size={compact ? 48 : 66} />
    <div>
      <div
        style={{
          color: "white",
          fontFamily: "Bricolage Grotesque, sans-serif",
          fontSize: compact ? 30 : 42,
          fontWeight: 800,
          lineHeight: 0.98,
          letterSpacing: -1.2,
        }}
      >
        VibeTide
      </div>
      <div
        style={{
          marginTop: 6,
          color: COLORS.coralSoft,
          fontFamily: "Space Mono, monospace",
          fontSize: compact ? 11 : 14,
          fontWeight: 700,
          letterSpacing: 2,
        }}
      >
        PLAY · BUILD · SHARE
      </div>
    </div>
  </div>
);

export const SceneTitle: React.FC<{
  eyebrow: string;
  headline: string;
  accent: Accent;
  style?: CSSProperties;
}> = ({eyebrow, headline, accent, style}) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [4, 28], [0, 1], {
    easing: Easing.bezier(0.16, 1, 0.3, 1),
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        opacity: enter,
        transform: `translateY(${interpolate(enter, [0, 1], [28, 0])}px)`,
        ...style,
      }}
    >
      <div
        style={{
          color: accentColor(accent),
          fontFamily: "Space Mono, monospace",
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: 3.2,
          textTransform: "uppercase",
          marginBottom: 12,
        }}
      >
        {eyebrow}
      </div>
      <div
        style={{
          color: COLORS.white,
          fontFamily: "Bricolage Grotesque, sans-serif",
          fontSize: 66,
          lineHeight: 0.98,
          fontWeight: 800,
          letterSpacing: -3.4,
          maxWidth: 1300,
        }}
      >
        {headline}
      </div>
    </div>
  );
};

export const Pill: React.FC<{
  children: ReactNode;
  accent?: Accent;
  active?: boolean;
  mono?: boolean;
  style?: CSSProperties;
}> = ({children, accent = "cyan", active = false, mono = false, style}) => {
  const color = accentColor(accent);
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 9,
        minHeight: 42,
        padding: "8px 14px",
        borderRadius: 14,
        background: active ? `${color}25` : "rgba(255,255,255,0.055)",
        border: `1px solid ${active ? `${color}b5` : "rgba(255,255,255,0.12)"}`,
        color: active ? COLORS.white : "rgba(239,248,255,0.74)",
        boxShadow: active ? `0 0 28px ${color}1f` : undefined,
        fontFamily: mono ? "Space Mono, monospace" : "IBM Plex Sans, sans-serif",
        fontSize: mono ? 16 : 19,
        fontWeight: active ? 700 : 600,
        whiteSpace: "nowrap",
        ...style,
      }}
    >
      {active ? (
        <span style={{width: 8, height: 8, borderRadius: 99, background: color}} />
      ) : null}
      {children}
    </div>
  );
};

export const OtterSprite: React.FC<{
  size?: number;
  style?: CSSProperties;
  excited?: boolean;
}> = ({size = 360, style, excited = false}) => {
  const frame = useCurrentFrame();
  const spriteIndex = excited ? 6 : 2 + (Math.floor(frame / 7) % 2);
  const column = spriteIndex % 4;
  const row = Math.floor(spriteIndex / 4);
  const scale = size / 444;
  const bounce = Math.sin(frame / 7) * 6;
  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        overflow: "hidden",
        transform: `translateY(${bounce}px)`,
        filter: "drop-shadow(0 26px 36px rgba(0,0,0,0.38))",
        ...style,
      }}
    >
      <Img
        src={staticFile("game/vibetide-otter-v1-atlas.png")}
        style={{
          position: "absolute",
          width: 1776 * scale,
          height: 888 * scale,
          maxWidth: "none",
          transform: `translate(${-column * size}px, ${-row * size}px)`,
        }}
      />
    </div>
  );
};

export const ProgressBar: React.FC<{
  sceneIndex: number;
  sceneFrame: number;
  sceneDuration: number;
}> = ({sceneIndex, sceneFrame, sceneDuration}) => {
  const local = interpolate(sceneFrame, [0, sceneDuration], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const total = (sceneIndex + local) / 8;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 0,
        height: 6,
        zIndex: 60,
        background: "rgba(255,255,255,0.08)",
      }}
    >
      <div
        style={{
          width: `${total * 100}%`,
          height: "100%",
          background: `linear-gradient(90deg, ${COLORS.coral}, ${COLORS.cyan})`,
          boxShadow: `0 0 20px ${COLORS.cyan}80`,
        }}
      />
    </div>
  );
};
