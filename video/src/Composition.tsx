import {Composition} from "remotion";
import {CompetitionVideo} from "./CompetitionVideo";
import {VOICEOVER_MANIFEST} from "./generated/voiceover-manifest";

export const FPS = 30;
export const TOTAL_FRAMES = VOICEOVER_MANIFEST.scenes.reduce(
  (sum, scene) => sum + scene.durationFrames,
  0,
);

export const VibeTideComposition: React.FC = () => {
  return (
    <Composition
      id="VibeTideWebMCPChallenge"
      component={CompetitionVideo}
      durationInFrames={TOTAL_FRAMES}
      fps={FPS}
      width={1920}
      height={1080}
      defaultProps={{}}
      calculateMetadata={() => ({
        durationInFrames: TOTAL_FRAMES,
        defaultOutName: "vibetide-webmcp-challenge.mp4",
        defaultCodec: "h264",
      })}
    />
  );
};
