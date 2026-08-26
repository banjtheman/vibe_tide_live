import type {ReactNode} from "react";
import {loadFont as loadBricolage} from "@remotion/google-fonts/BricolageGrotesque";
import {loadFont as loadIBM} from "@remotion/google-fonts/IBMPlexSans";
import {loadFont as loadMono} from "@remotion/google-fonts/SpaceMono";
import {Audio, Video} from "@remotion/media";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Series,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import {ChromeFrame} from "./components/ChromeFrame";
import {CaptionOverlay} from "./components/CaptionOverlay";
import {
  Brand,
  COLORS,
  OceanField,
  OtterSprite,
  Pill,
  ProgressBar,
  SceneTitle,
  WaveMark,
  accentColor,
} from "./components/VisualKit";
import {DEMO_PROMPT, STORY_SCENES, WEBMCP_TOOLS, type SceneId} from "./content";
import {CAPTURE_MANIFEST} from "./generated/capture-manifest";
import {VOICEOVER_MANIFEST} from "./generated/voiceover-manifest";

loadBricolage("normal", {weights: ["600", "700", "800"], subsets: ["latin"]});
loadIBM("normal", {
  weights: ["400", "500", "600", "700"],
  subsets: ["latin"],
});
loadMono("normal", {weights: ["400", "700"], subsets: ["latin"]});

type GeneratedScene = (typeof VOICEOVER_MANIFEST.scenes)[number];

const sceneStory = (id: SceneId) => {
  const scene = STORY_SCENES.find((candidate) => candidate.id === id);
  if (!scene) throw new Error(`Missing story scene: ${id}`);
  return scene;
};

const sceneAudio = (id: SceneId) => {
  const scene = VOICEOVER_MANIFEST.scenes.find((candidate) => candidate.id === id);
  if (!scene) throw new Error(`Missing voiceover scene: ${id}`);
  return scene;
};

const SceneScaffold: React.FC<{
  scene: GeneratedScene;
  sceneIndex: number;
  children: ReactNode;
}> = ({scene, sceneIndex, children}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(
    frame,
    [0, 12, scene.durationFrames - 12, scene.durationFrames],
    [0, 1, 1, 0],
    {extrapolateLeft: "clamp", extrapolateRight: "clamp"},
  );
  return (
    <AbsoluteFill style={{opacity}}>
      {children}
      <Audio src={staticFile(scene.audioFile)} volume={1} />
      <ProgressBar
        sceneIndex={sceneIndex}
        sceneFrame={frame}
        sceneDuration={scene.durationFrames}
      />
      <CaptionOverlay captions={scene.captions.map((caption) => ({...caption}))} />
    </AbsoluteFill>
  );
};

const HookScene: React.FC = () => {
  const frame = useCurrentFrame();
  const story = sceneStory("hook");
  const typed = Math.floor(
    interpolate(frame, [18, 190], [0, DEMO_PROMPT.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: Easing.inOut(Easing.cubic),
    }),
  );
  const heroEnter = interpolate(frame, [22, 55], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <OceanField accent="coral" image="worlds/neon-moonwave.webp">
      <div style={{position: "absolute", left: 82, top: 58}}>
        <Brand />
      </div>
      <div style={{position: "absolute", left: 86, top: 214, width: 720}}>
        <SceneTitle
          eyebrow={story.eyebrow}
          headline={story.headline}
          accent={story.accent}
        />
        <div
          style={{
            marginTop: 34,
            width: 700,
            minHeight: 190,
            padding: "28px 30px",
            borderRadius: 26,
            background: "rgba(8,20,39,0.82)",
            border: `1px solid ${COLORS.coral}88`,
            boxShadow: "0 28px 70px rgba(1,8,18,0.42)",
            color: COLORS.cream,
            fontFamily: "IBM Plex Sans, sans-serif",
            fontSize: 27,
            lineHeight: 1.35,
            opacity: heroEnter,
            transform: `translateY(${interpolate(heroEnter, [0, 1], [24, 0])}px)`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              marginBottom: 18,
              color: COLORS.coralSoft,
              fontFamily: "Space Mono, monospace",
              fontSize: 15,
              fontWeight: 700,
              letterSpacing: 1.5,
            }}
          >
            <span
              style={{width: 10, height: 10, borderRadius: 99, background: COLORS.coral}}
            />
            ASK CODEX
          </div>
          {DEMO_PROMPT.slice(0, typed)}
          <span
            style={{
              display: "inline-block",
              width: 3,
              height: 30,
              marginLeft: 3,
              background: COLORS.cyan,
              opacity: Math.floor(frame / 10) % 2 ? 0.2 : 1,
            }}
          />
        </div>
      </div>
      <ChromeFrame
        file={CAPTURE_MANIFEST.agentLoop.file}
        startAtSeconds={CAPTURE_MANIFEST.agentLoop.markers.prompt}
        style={{right: 72, top: 154, width: 950, height: 615}}
        badge={
          <Pill accent="coral" active mono>
            create_level_from_blueprint
          </Pill>
        }
      />
      <OtterSprite size={300} style={{right: 90, bottom: 45}} excited />
      <div style={{position: "absolute", right: 422, bottom: 140}}>
        <Pill accent="green" active>
          ✓ Playable instantly
        </Pill>
      </div>
    </OceanField>
  );
};

const PlayScene: React.FC = () => {
  const story = sceneStory("play");
  return (
    <OceanField accent="cyan" image="worlds/golden-coast.webp">
      <SceneTitle
        eyebrow={story.eyebrow}
        headline={story.headline}
        accent={story.accent}
        style={{position: "absolute", left: 82, top: 46, zIndex: 10}}
      />
      <ChromeFrame
        file={CAPTURE_MANIFEST.gameplay.file}
        startAtSeconds={CAPTURE_MANIFEST.gameplay.markers.gameplay}
        loop={false}
        style={{left: 72, top: 180, width: 1370, height: 782}}
        badge={
          <Pill accent="cyan" active>
            LIVE GAMEPLAY
          </Pill>
        }
      />
      <div
        style={{
          position: "absolute",
          right: 78,
          top: 182,
          width: 368,
          height: 706,
          padding: 12,
          borderRadius: 46,
          background: "linear-gradient(160deg, #283145, #080d17)",
          border: "1px solid rgba(255,255,255,0.18)",
          boxShadow: "0 34px 80px rgba(0,0,0,0.46)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 130,
            top: 6,
            width: 108,
            height: 18,
            borderRadius: 20,
            background: "#050910",
            zIndex: 5,
          }}
        />
        <Video
          src={staticFile(CAPTURE_MANIFEST.mobile.file)}
          muted
          loop={false}
          objectFit="cover"
          trimBefore={Math.round(CAPTURE_MANIFEST.mobile.markers.mobile_play * 30)}
          style={{
            width: "100%",
            height: "100%",
            objectPosition: "center top",
            borderRadius: 34,
          }}
        />
      </div>
      <div
        style={{position: "absolute", right: 84, bottom: 104, display: "flex", gap: 10}}
      >
        <Pill>A / D</Pill>
        <Pill>SPACE</Pill>
        <Pill accent="coral">TOUCH</Pill>
      </div>
    </OceanField>
  );
};

const WebMCPScene: React.FC = () => {
  const frame = useCurrentFrame();
  const story = sceneStory("webmcp");
  return (
    <OceanField accent="violet" image="worlds/kelp-cathedral.webp">
      <div style={{position: "absolute", left: 78, top: 50}}>
        <Brand compact />
      </div>
      <SceneTitle
        eyebrow={story.eyebrow}
        headline={story.headline}
        accent={story.accent}
        style={{position: "absolute", left: 78, top: 162, zIndex: 10}}
      />
      <div
        style={{
          position: "absolute",
          left: 78,
          top: 360,
          width: 660,
          padding: "30px 32px",
          borderRadius: 28,
          background: "rgba(7,20,39,0.82)",
          border: "1px solid rgba(122,228,243,0.2)",
        }}
      >
        <div
          style={{
            color: COLORS.white,
            fontFamily: "Bricolage Grotesque, sans-serif",
            fontSize: 38,
            fontWeight: 750,
            lineHeight: 1.12,
          }}
        >
          A structured contract between the page and the agent.
        </div>
        <div
          style={{marginTop: 22, display: "flex", alignItems: "center", gap: 15}}
        >
          <Pill accent="cyan" active>
            VibeTide page
          </Pill>
          <span style={{color: COLORS.cyan, fontSize: 30}}>→</span>
          <Pill accent="violet" active>
            10 tools
          </Pill>
          <span style={{color: COLORS.cyan, fontSize: 30}}>→</span>
          <Pill accent="coral" active>
            Codex
          </Pill>
        </div>
        <div
          style={{
            marginTop: 26,
            color: "rgba(233,245,251,0.72)",
            fontFamily: "IBM Plex Sans, sans-serif",
            fontSize: 22,
            lineHeight: 1.45,
          }}
        >
          New for the challenge: a browser-native VibeTide rebuild with a
          non-trivial WebMCP creation and playtest layer.
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          right: 74,
          top: 176,
          width: 1030,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 15,
        }}
      >
        {WEBMCP_TOOLS.map((tool, index) => {
          const appear = interpolate(frame, [28 + index * 8, 48 + index * 8], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.16, 1, 0.3, 1),
          });
          const highlighted =
            index === Math.floor((Math.max(0, frame - 80) / 40) % WEBMCP_TOOLS.length);
          return (
            <div
              key={tool}
              style={{
                height: 72,
                borderRadius: 18,
                padding: "0 20px",
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: highlighted
                  ? "rgba(154,100,232,0.26)"
                  : "rgba(7,20,39,0.78)",
                border: `1px solid ${
                  highlighted
                    ? "rgba(174,125,247,0.86)"
                    : "rgba(255,255,255,0.1)"
                }`,
                color: highlighted ? COLORS.white : "rgba(233,245,251,0.76)",
                fontFamily: "Space Mono, monospace",
                fontSize: 18,
                fontWeight: highlighted ? 700 : 400,
                opacity: appear,
                transform: `translateX(${interpolate(appear, [0, 1], [36, 0])}px)`,
                boxShadow: highlighted
                  ? "0 0 30px rgba(154,100,232,0.2)"
                  : undefined,
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 9,
                  display: "grid",
                  placeItems: "center",
                  color: highlighted ? COLORS.ink : COLORS.cyan,
                  background: highlighted ? COLORS.cyan : "rgba(68,216,233,0.12)",
                  fontSize: 15,
                }}
              >
                ↗
              </span>
              {tool}
            </div>
          );
        })}
      </div>
    </OceanField>
  );
};

const AgentCreateScene: React.FC = () => {
  const frame = useCurrentFrame();
  const story = sceneStory("agent-create");
  const steps = [
    {label: "REQUEST", detail: "Sunset Circuit", start: 18, accent: "coral" as const},
    {
      label: "TOOL",
      detail: "create_level_from_blueprint",
      start: 78,
      accent: "violet" as const,
    },
    {
      label: "CHECK",
      detail: "validate_level → valid",
      start: 270,
      accent: "green" as const,
    },
  ];
  return (
    <OceanField accent="coral" image="worlds/neon-moonwave.webp">
      <div style={{position: "absolute", left: 66, top: 48}}>
        <Brand compact />
      </div>
      <div style={{position: "absolute", left: 66, top: 150, width: 480}}>
        <SceneTitle
          eyebrow={story.eyebrow}
          headline={story.headline}
          accent={story.accent}
        />
        <div
          style={{
            marginTop: 30,
            padding: 24,
            borderRadius: 24,
            background: "rgba(7,19,38,0.88)",
            border: `1px solid ${COLORS.coral}66`,
            color: COLORS.cream,
            fontFamily: "IBM Plex Sans, sans-serif",
            fontSize: 21,
            lineHeight: 1.42,
          }}
        >
          {DEMO_PROMPT}
        </div>
        <div
          style={{marginTop: 24, display: "flex", flexDirection: "column", gap: 12}}
        >
          {steps.map((step, index) => {
            const active =
              frame >= step.start && frame < (steps[index + 1]?.start ?? 9999);
            const done = frame >= (steps[index + 1]?.start ?? 9999);
            return (
              <div
                key={step.label}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  opacity: frame >= step.start ? 1 : 0.28,
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 99,
                    display: "grid",
                    placeItems: "center",
                    background:
                      active || done
                        ? accentColor(step.accent)
                        : "rgba(255,255,255,0.12)",
                    color: COLORS.ink,
                    fontFamily: "Space Mono, monospace",
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {done ? "✓" : index + 1}
                </div>
                <Pill
                  accent={step.accent}
                  active={active}
                  mono
                  style={{flex: 1, justifyContent: "space-between"}}
                >
                  <span>{step.label}</span>
                  <span>{step.detail}</span>
                </Pill>
              </div>
            );
          })}
        </div>
      </div>
      <ChromeFrame
        file={CAPTURE_MANIFEST.agentLoop.file}
        startAtSeconds={CAPTURE_MANIFEST.agentLoop.markers.prompt}
        loop={false}
        style={{right: 54, top: 120, width: 1300, height: 812}}
        badge={
          <Pill accent="green" active>
            REAL PAGE TOOLS
          </Pill>
        }
      />
      <div
        style={{position: "absolute", right: 92, bottom: 88, display: "flex", gap: 12}}
      >
        <Pill accent="coral" active>
          MADE BY CODEX
        </Pill>
        <Pill accent="green" active>
          ✓ READY TO RIDE
        </Pill>
      </div>
    </OceanField>
  );
};

const PlaytestScene: React.FC = () => {
  const frame = useCurrentFrame();
  const story = sceneStory("playtest");
  const progress = ["CREATE", "VALIDATE", "PLAY", "LEARN", "REPAIR"];
  const active = Math.min(
    progress.length - 1,
    Math.floor(
      interpolate(frame, [0, 470], [2, 5], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
    ),
  );
  return (
    <OceanField accent="gold" image="worlds/neon-moonwave.webp">
      <SceneTitle
        eyebrow={story.eyebrow}
        headline={story.headline}
        accent={story.accent}
        style={{position: "absolute", left: 74, top: 48, zIndex: 8}}
      />
      <ChromeFrame
        file={CAPTURE_MANIFEST.agentLoop.file}
        startAtSeconds={CAPTURE_MANIFEST.agentLoop.markers.play}
        loop={false}
        style={{left: 70, top: 188, width: 1470, height: 820}}
        badge={
          <Pill accent="gold" active>
            PLAYTEST TELEMETRY
          </Pill>
        }
      />
      <div
        style={{
          position: "absolute",
          right: 52,
          top: 230,
          width: 300,
          padding: 24,
          borderRadius: 26,
          background: "rgba(7,18,36,0.92)",
          border: "1px solid rgba(255,200,87,0.44)",
          boxShadow: "0 28px 70px rgba(0,0,0,0.42)",
        }}
      >
        {[
          {value: "1", label: "trouble spot found"},
          {value: "1", label: "targeted patch"},
          {value: "✓", label: "route valid"},
        ].map((metric) => (
          <div
            key={metric.label}
            style={{
              padding: "18px 0",
              borderBottom: "1px solid rgba(255,255,255,0.09)",
            }}
          >
            <div
              style={{
                color: COLORS.gold,
                fontFamily: "Bricolage Grotesque, sans-serif",
                fontSize: 52,
                fontWeight: 800,
                lineHeight: 1,
              }}
            >
              {metric.value}
            </div>
            <div
              style={{
                marginTop: 7,
                color: "rgba(239,247,251,0.68)",
                fontFamily: "IBM Plex Sans, sans-serif",
                fontSize: 18,
              }}
            >
              {metric.label}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          left: 96,
          right: 420,
          bottom: 92,
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}
      >
        {progress.map((label, index) => (
          <Pill
            key={label}
            accent={index === 4 ? "coral" : index === 3 ? "violet" : "gold"}
            active={index === active}
            mono
            style={{flex: 1, justifyContent: "center"}}
          >
            {label}
          </Pill>
        ))}
      </div>
    </OceanField>
  );
};

const BuildScene: React.FC = () => {
  const frame = useCurrentFrame();
  const story = sceneStory("build");
  const worlds = [
    ["Golden Coast", "worlds/golden-coast.webp"],
    ["Neon Moonwave", "worlds/neon-moonwave.webp"],
    ["Glow Grotto", "worlds/glow-grotto.webp"],
    ["Kelp Cathedral", "worlds/kelp-cathedral.webp"],
    ["Festival Shore", "worlds/festival-shore.webp"],
  ] as const;
  return (
    <OceanField accent="green" image="worlds/glow-grotto.webp">
      <SceneTitle
        eyebrow={story.eyebrow}
        headline={story.headline}
        accent={story.accent}
        style={{position: "absolute", left: 74, top: 48, zIndex: 8}}
      />
      <ChromeFrame
        file={CAPTURE_MANIFEST.humanBuild.file}
        startAtSeconds={CAPTURE_MANIFEST.humanBuild.markers.ready}
        style={{left: 70, top: 184, width: 1480, height: 804}}
        badge={
          <Pill accent="green" active>
            HUMAN EDIT
          </Pill>
        }
      />
      <div
        style={{
          position: "absolute",
          right: 48,
          top: 226,
          width: 310,
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        {worlds.map(([name, file], index) => {
          const enter = interpolate(
            frame,
            [28 + index * 9, 50 + index * 9],
            [0, 1],
            {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
              easing: Easing.out(Easing.cubic),
            },
          );
          return (
            <div
              key={name}
              style={{
                height: 120,
                borderRadius: 20,
                overflow: "hidden",
                border: `2px solid ${
                  index === Math.floor((frame / 65) % worlds.length)
                    ? COLORS.green
                    : "rgba(255,255,255,0.18)"
                }`,
                position: "relative",
                opacity: enter,
                transform: `translateX(${interpolate(enter, [0, 1], [30, 0])}px)`,
                boxShadow: "0 16px 36px rgba(0,0,0,0.28)",
              }}
            >
              <Img
                src={staticFile(file)}
                style={{width: "100%", height: "100%", objectFit: "cover"}}
              />
              <div
                style={{
                  position: "absolute",
                  inset: "auto 0 0",
                  padding: "24px 13px 10px",
                  background: "linear-gradient(transparent, rgba(3,9,20,0.9))",
                  color: "white",
                  fontFamily: "Bricolage Grotesque, sans-serif",
                  fontWeight: 700,
                  fontSize: 18,
                }}
              >
                {name}
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{position: "absolute", left: 98, bottom: 88, display: "flex", gap: 10}}
      >
        {["REEF ROCK", "SEA GLASS", "DEEP WATER", "HOT VENT", "3 ENEMIES"].map(
          (piece, index) => (
            <Pill
              key={piece}
              accent={index === 4 ? "coral" : "green"}
              active={index === Math.floor((frame / 72) % 5)}
              mono
            >
              {piece}
            </Pill>
          ),
        )}
      </div>
    </OceanField>
  );
};

const ShareScene: React.FC = () => {
  const frame = useCurrentFrame();
  const story = sceneStory("share");
  const code = "vt2.WzIsWyJ0aWRlXz…&mode=play";
  const reveal = Math.floor(
    interpolate(frame, [38, 150], [0, code.length], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    }),
  );
  return (
    <OceanField accent="cyan" image="worlds/festival-shore.webp">
      <SceneTitle
        eyebrow={story.eyebrow}
        headline={story.headline}
        accent={story.accent}
        style={{position: "absolute", left: 74, top: 46, zIndex: 8}}
      />
      <ChromeFrame
        file={CAPTURE_MANIFEST.share.file}
        startAtSeconds={CAPTURE_MANIFEST.share.markers.share}
        style={{left: 70, top: 185, width: 1510, height: 795}}
        badge={
          <Pill accent="cyan" active>
            SHARE ROUND-TRIP
          </Pill>
        }
      />
      <div
        style={{
          position: "absolute",
          right: 48,
          top: 262,
          width: 320,
          padding: 25,
          borderRadius: 26,
          background: "rgba(7,18,36,0.92)",
          border: "1px solid rgba(68,216,233,0.48)",
          boxShadow: "0 28px 70px rgba(0,0,0,0.4)",
        }}
      >
        <div
          style={{
            color: COLORS.cyan,
            fontFamily: "Space Mono, monospace",
            fontSize: 13,
            letterSpacing: 2,
            fontWeight: 700,
          }}
        >
          SELF-CONTAINED LEVEL
        </div>
        <div
          style={{
            marginTop: 18,
            minHeight: 90,
            color: COLORS.white,
            fontFamily: "Space Mono, monospace",
            fontSize: 18,
            lineHeight: 1.45,
            overflowWrap: "anywhere",
          }}
        >
          {code.slice(0, reveal)}
          <span style={{color: COLORS.coral}}>|</span>
        </div>
        <div
          style={{marginTop: 20, display: "flex", flexDirection: "column", gap: 11}}
        >
          <Pill accent="green" active>
            ✓ Opens in Play
          </Pill>
          <Pill>No account</Pill>
          <Pill>No JSON download</Pill>
          <Pill accent="violet">Ready to remix</Pill>
        </div>
      </div>
    </OceanField>
  );
};

const CloseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const story = sceneStory("close");
  const enter = interpolate(frame, [8, 44], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });
  return (
    <OceanField accent="coral" image="brand/og-v1.png">
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(90deg, rgba(4,14,30,0.94) 0%, rgba(4,14,30,0.76) 48%, rgba(4,14,30,0.24) 100%)",
        }}
      />
      <div style={{position: "absolute", left: 94, top: 88}}>
        <Brand />
      </div>
      <div
        style={{
          position: "absolute",
          left: 94,
          top: 300,
          width: 930,
          opacity: enter,
          transform: `translateY(${interpolate(enter, [0, 1], [32, 0])}px)`,
        }}
      >
        <div
          style={{
            color: COLORS.coralSoft,
            fontFamily: "Space Mono, monospace",
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: 3,
            textTransform: "uppercase",
          }}
        >
          {story.eyebrow}
        </div>
        <div
          style={{
            marginTop: 18,
            color: COLORS.white,
            fontFamily: "Bricolage Grotesque, sans-serif",
            fontSize: 92,
            fontWeight: 800,
            lineHeight: 0.95,
            letterSpacing: -5,
          }}
        >
          {story.headline}
        </div>
        <div style={{marginTop: 36, display: "flex", gap: 14}}>
          <Pill accent="coral" active>
            PLAY
          </Pill>
          <Pill accent="cyan" active>
            BUILD
          </Pill>
          <Pill accent="violet" active>
            SHARE
          </Pill>
        </div>
        <div
          style={{
            marginTop: 42,
            display: "inline-flex",
            alignItems: "center",
            gap: 16,
            padding: "16px 20px",
            borderRadius: 18,
            background: "rgba(7,18,36,0.82)",
            border: "1px solid rgba(255,255,255,0.16)",
            color: COLORS.white,
            fontFamily: "Space Mono, monospace",
            fontSize: 23,
          }}
        >
          <WaveMark size={42} />
          vibetide-live.banjtheman.chatgpt.site
        </div>
      </div>
      <OtterSprite size={490} style={{right: 178, bottom: 78}} excited />
    </OceanField>
  );
};

const renderScene = (id: SceneId): ReactNode => {
  if (id === "hook") return <HookScene />;
  if (id === "play") return <PlayScene />;
  if (id === "webmcp") return <WebMCPScene />;
  if (id === "agent-create") return <AgentCreateScene />;
  if (id === "playtest") return <PlaytestScene />;
  if (id === "build") return <BuildScene />;
  if (id === "share") return <ShareScene />;
  return <CloseScene />;
};

export const CompetitionVideo: React.FC = () => {
  const {durationInFrames} = useVideoConfig();
  return (
    <AbsoluteFill style={{background: COLORS.ink}}>
      <Audio
        src={staticFile("audio/vibetide-bed.mp3")}
        volume={(frame) =>
          interpolate(
            frame,
            [0, 45, durationInFrames - 90, durationInFrames],
            [0, 0.075, 0.075, 0],
            {extrapolateLeft: "clamp", extrapolateRight: "clamp"},
          )
        }
      />
      <Series>
        {STORY_SCENES.map((story, index) => {
          const scene = sceneAudio(story.id);
          return (
            <Series.Sequence
              key={story.id}
              durationInFrames={scene.durationFrames}
              premountFor={30}
            >
              <SceneScaffold scene={scene} sceneIndex={index}>
                {renderScene(story.id)}
              </SceneScaffold>
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
};
