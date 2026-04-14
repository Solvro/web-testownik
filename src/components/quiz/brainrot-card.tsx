"use client";

import {
  BoxIcon,
  BubblesIcon,
  PauseIcon,
  ShuffleIcon,
  SprayCanIcon,
} from "lucide-react";
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

export function BrainrotCard(): React.JSX.Element {
  // Subway Surfers is default video
  const [brainrotVideo, setBrainrotVideo] = React.useState(
    "https://www.youtube.com/watch?v=zZ7AimPACzc",
  );
  const [isVideoPlaying, setIsVideoPlaying] = React.useState(true);

  const handleBrainrotVideoChange = (video: string) => {
    setBrainrotVideo(video);
    setIsVideoPlaying(true);
  };

  return (
    <div className="animate-in fade-in lg:slide-in-from-right duration-300">
      <Card>
        <CardContent>
          <AspectRatio
            ratio={9 / 20}
            role="button"
            tabIndex={0}
            aria-label="Play/pause brainrot video"
            className="relative flex flex-col items-center justify-center overflow-hidden rounded-md"
            onClick={() => {
              setIsVideoPlaying(!isVideoPlaying);
            }}
          >
            {!isVideoPlaying && (
              <div className="animate-in fade-in z-20 rounded-full bg-black/60 p-4">
                <PauseIcon className="size-10" />
              </div>
            )}

            <ReactPlayer
              src={brainrotVideo}
              playing={isVideoPlaying}
              playsInline
              loop
              muted
              controls={false}
              width="auto"
              height="100%"
              className="absolute top-1/2 left-1/2 min-w-[395%] -translate-x-1/2 -translate-y-1/2"
              style={{ pointerEvents: "none" }}
            />
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
                      handleBrainrotVideoChange(
                        "https://www.youtube.com/watch?v=9q6eL3iSATM&t=756s",
                      );
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
                      handleBrainrotVideoChange(
                        "https://www.youtube.com/watch?v=vrcSq1-r25U&list=PLmSs-0cFIbfVWhkZx0i4UMiZdr2C0Z8w7",
                      );
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
                      handleBrainrotVideoChange(
                        "https://www.youtube.com/watch?v=IiEVXWIIr0k",
                      );
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
                      handleBrainrotVideoChange(
                        "https://www.youtube.com/watch?v=zZ7AimPACzc",
                      );
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
