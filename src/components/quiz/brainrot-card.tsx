"use client";

import { BoxIcon, BubblesIcon, ShuffleIcon, SprayCanIcon } from "lucide-react";
import React from "react";
import ReactPlayer from "react-player";

import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const DEFAULT_BRAINROT_VIDEO_ID = "zZ7AimPACzc";
const BRAINROT_RANDOM_START_MAX_SECONDS = 907;

function getBrainrotVideoUrl(videoId: string): string {
  const startSeconds = Math.floor(
    Math.random() * (BRAINROT_RANDOM_START_MAX_SECONDS + 1),
  );
  const url = new URL("https://www.youtube.com/watch");

  url.searchParams.set("v", videoId);
  url.searchParams.set("t", `${String(startSeconds)}s`);
  url.searchParams.set("cc_load_policy", "3");

  return url.toString();
}

export function BrainrotCard(): React.JSX.Element {
  // Subway Surfers is default video
  const [brainrotVideo, setBrainrotVideo] = React.useState(
    getBrainrotVideoUrl(DEFAULT_BRAINROT_VIDEO_ID),
  );
  const [isVideoPlaying, setIsVideoPlaying] = React.useState(true);

  const handleBrainrotVideoChange = (videoId: string) => {
    setBrainrotVideo(getBrainrotVideoUrl(videoId));
    setIsVideoPlaying(true);
  };

  return (
    <div className="animate-in fade-in lg:slide-in-from-right duration-300">
      <Card>
        <CardContent>
          <AspectRatio ratio={9 / 20} className="overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              <ReactPlayer
                src={brainrotVideo}
                playing={isVideoPlaying}
                playsInline
                loop
                muted
                controls={false}
                width="360%"
                height="100%"
                style={{ position: "absolute" }}
              />
            </div>
          </AspectRatio>
          <div className="flex items-center justify-around gap-2 pt-6">
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Wybierz film: Brainrot memes"
                    onClick={() => {
                      handleBrainrotVideoChange("vY4nBa_JWrM");
                    }}
                  >
                    <ShuffleIcon />
                  </Button>
                }
              ></TooltipTrigger>
              <TooltipContent>Brainrot memes</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Wybierz film: Minecraft parkour"
                    onClick={() => {
                      handleBrainrotVideoChange("vrcSq1-r25U");
                    }}
                  >
                    <BoxIcon />
                  </Button>
                }
              ></TooltipTrigger>
              <TooltipContent>Minecraft parkour</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Wybierz film: Mydełka"
                    onClick={() => {
                      handleBrainrotVideoChange("IiEVXWIIr0k");
                    }}
                  >
                    <BubblesIcon />
                  </Button>
                }
              ></TooltipTrigger>
              <TooltipContent>Mydełka</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Wybierz film: Subway Surfers"
                    onClick={() => {
                      handleBrainrotVideoChange(DEFAULT_BRAINROT_VIDEO_ID);
                    }}
                  >
                    <SprayCanIcon />
                  </Button>
                }
              ></TooltipTrigger>
              <TooltipContent>Subway Surfers</TooltipContent>
            </Tooltip>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
