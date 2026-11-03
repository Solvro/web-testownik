import React from "react";

interface BannedScreenProps {
  reason?: string;
}

export function BannedScreen({ reason }: BannedScreenProps): React.JSX.Element {
  return (
    <>
      <style>
        {`
        @font-face {
          font-family: "Minecraft";
          src: url("/banned-screen/mc-font.otf") format("opentype");
        }
        `}
      </style>
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#2b2b2b] p-4 text-[#bfbfbf] selection:bg-white/20 selection:text-white"
        style={{
          fontFamily: "Minecraft",
          backgroundImage: "url(/banned-screen/dirt-background.webp)",
          imageRendering: "pixelated",
        }}
      >
        <div className="animate-in fade-in zoom-in relative flex w-full max-w-2xl flex-col items-center gap-8 text-center duration-300">
          <h1 className="text-xl font-bold text-[#aaaaaa]">Connection Lost</h1>

          <div className="max-w-lg space-y-1">
            <p className="text-lg font-bold text-white">
              You are banned from this server!
            </p>
            <div className="py-2">
              {reason != null && (
                <p className="text-base break-words whitespace-pre-wrap text-white">
                  Reason: {reason}
                </p>
              )}
            </div>
            <p className="text-sm text-white">
              Appeal at{" "}
              <a
                href="mailto:testownik@solvro.pl"
                className="underline transition-colors hover:text-white"
              >
                testownik@solvro.pl
              </a>
            </p>
          </div>

          <button
            className="h-12 rounded-none border-2 border-[#1e1e1f] bg-[#3c3c3c] px-4 text-base text-white shadow-[inset_0_-2px_0_0_#1e1e1f,inset_0_2px_0_0_#5e5e60,inset_-2px_0_0_0_#1e1e1f,inset_2px_0_0_0_#5e5e60] hover:border-white/50 hover:bg-[#2b2b2e] hover:text-white active:border-[#1e1e1f] active:bg-[#1e1e1f]"
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Back to server list
          </button>
        </div>
      </div>
    </>
  );
}
