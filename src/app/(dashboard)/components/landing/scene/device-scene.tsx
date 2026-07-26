"use client";

import Image from "next/image";
import { useState } from "react";
import type { CSSProperties } from "react";

import { Glass } from "@/components/canvasui/Glass";
import {
  PhoneQuizSurface,
  ProductAppChrome,
  StatsPreviewSurface,
} from "@/components/testownik-preview/product-surfaces";
import { cn } from "@/lib/utils";

import { HERO_PROGRESS } from "../hero-progress";
import { wordmarkDark, wordmarkLight } from "../logos";
import { DeviceStack } from "./device-stack";
import { SCENE_CLASS } from "./scene-classes";

const glowStyle: CSSProperties = {
  opacity: `calc(0.16 + ${HERO_PROGRESS} * 0.2)`,
  transform: `translate(-50%, -50%) scale(calc(0.86 + ${HERO_PROGRESS} * 0.16))`,
};

/** Appears above the open laptop, once the lid is most of the way up. */
const openLogoStyle: CSSProperties = {
  opacity: `clamp(0, calc((${HERO_PROGRESS} - 0.6) * 6), 1)`,
  transform: `translate(-50%, calc((1 - ${HERO_PROGRESS}) * 1.5rem)) scale(calc(0.96 + ${HERO_PROGRESS} * 0.04))`,
};

const mobilePhoneStyle: CSSProperties = {
  transform: `translate(-50%, calc(-50% - ${HERO_PROGRESS} * 3rem)) rotate(calc(-2deg + ${HERO_PROGRESS} * 3deg))`,
};

/**
 * Wraps a device screen in CanvasUI's magnifier.
 *
 * The lens must be scoped tightly to painted content: its shader samples RGB
 * and discards alpha, so any transparent pixel underneath it renders black.
 * Wrapping a device's whole positioning box gives a black lens with ragged
 * edges hanging outside the frame.
 */
function GlassScreen({
  children,
  targets,
  onHoverChange,
}: {
  children: React.ReactNode;
  targets?: string;
  onHoverChange?: (hovered: boolean) => void;
}): React.JSX.Element {
  return (
    <div
      className="relative isolate size-full overflow-hidden"
      onPointerEnter={() => {
        onHoverChange?.(true);
      }}
      onPointerLeave={() => {
        onHoverChange?.(false);
      }}
    >
      <Glass
        className={cn("size-full", SCENE_CLASS.deviceGlass)}
        size={60}
        targets={targets}
      >
        {children}
      </Glass>
    </div>
  );
}

function PhoneScreen({
  selectedAnswers,
  onSelectedAnswersChange,
  questionChecked,
  onQuestionCheckedChange,
  onHoverChange,
}: {
  selectedAnswers: string[];
  onSelectedAnswersChange: (answers: string[]) => void;
  questionChecked: boolean;
  onQuestionCheckedChange: (checked: boolean) => void;
  onHoverChange?: (hovered: boolean) => void;
}): React.JSX.Element {
  return (
    <GlassScreen
      onHoverChange={onHoverChange}
      targets="button, [data-slot=card-title]"
    >
      <PhoneQuizSurface
        selectedAnswers={selectedAnswers}
        onSelectedAnswersChange={onSelectedAnswersChange}
        questionChecked={questionChecked}
        onQuestionCheckedChange={onQuestionCheckedChange}
      />
    </GlassScreen>
  );
}

/**
 * The hero's device composition: a MacBook that opens on scroll with an iPad
 * and an iPhone that ride its lid, all three running real Testownik UI.
 *
 * Phones get none of it. Below 681px the 3D stack never boots (see
 * `DeviceStack`) and a single floating iPhone stands in for the whole scene.
 */
export function DeviceScene({
  captureLoadingCover = false,
  captureMode = false,
  capturePixelRatio,
  onSatelliteHoverChange,
}: {
  captureLoadingCover?: boolean;
  captureMode?: boolean;
  capturePixelRatio?: number;
  onSatelliteHoverChange?: (hovered: boolean) => void;
}): React.JSX.Element {
  const [selectedAnswers, setSelectedAnswers] = useState<string[]>(["a-4"]);
  const [questionChecked, setQuestionChecked] = useState(false);

  return (
    <div
      aria-label="MacBook Pro otwierający Testownik oraz statystyki na iPadzie i quiz na iPhonie"
      className="pointer-events-none absolute inset-0 isolate"
    >
      {captureMode ? null : (
        <>
          <div
            aria-hidden="true"
            style={glowStyle}
            className="bg-primary/16 absolute top-[63%] left-[56%] hidden h-[25rem] w-[min(74vw,72rem)] rounded-full blur-[90px] sm:block"
          />
          <div
            aria-hidden="true"
            style={openLogoStyle}
            className="absolute top-[clamp(5.5rem,10vh,8rem)] left-1/2 z-6 hidden w-[clamp(13rem,17vw,20rem)] transition-opacity duration-[120ms] sm:block"
          >
            <Image
              src={wordmarkLight}
              alt=""
              className="block h-auto w-full dark:hidden"
            />
            <Image
              src={wordmarkDark}
              alt=""
              className="hidden h-auto w-full dark:block"
            />
          </div>
        </>
      )}

      {/*
       * Deliberately untransformed: a CSS transform or filter on an ancestor of
       * the CSS3D layer is applied on top of the perspective CSS3DRenderer
       * derives from the camera, which detaches every screen from its bezel.
       * All framing lives in the camera instead.
       */}
      <div className="absolute inset-0 z-2 hidden sm:block">
        <DeviceStack
          coverOnly={captureLoadingCover}
          pixelRatio={capturePixelRatio}
          laptopContent={
            <ProductAppChrome
              selectedAnswers={selectedAnswers}
              onSelectedAnswersChange={setSelectedAnswers}
              questionChecked={questionChecked}
              onQuestionCheckedChange={setQuestionChecked}
            />
          }
          tabletContent={
            <GlassScreen onHoverChange={onSatelliteHoverChange}>
              <StatsPreviewSurface density="compact" />
            </GlassScreen>
          }
          phoneContent={
            <PhoneScreen
              selectedAnswers={selectedAnswers}
              onSelectedAnswersChange={setSelectedAnswers}
              questionChecked={questionChecked}
              onQuestionCheckedChange={setQuestionChecked}
              onHoverChange={onSatelliteHoverChange}
            />
          }
        />
      </div>

      {captureMode ? null : (
        <div
          style={mobilePhoneStyle}
          className={cn(
            SCENE_CLASS.mobilePhone,
            "pointer-events-auto absolute top-1/2 left-1/2 z-7 block h-[868px] w-[428px] sm:hidden",
          )}
        >
          <div className="device device-iphone-14-pro">
            <div className="device-frame">
              <div
                className={cn(
                  "device-screen bg-background overflow-hidden",
                  "[&>*]:size-full",
                )}
              >
                <PhoneScreen
                  selectedAnswers={selectedAnswers}
                  onSelectedAnswersChange={setSelectedAnswers}
                  questionChecked={questionChecked}
                  onQuestionCheckedChange={setQuestionChecked}
                  onHoverChange={onSatelliteHoverChange}
                />
              </div>
            </div>
            <div className="device-stripe" />
            <div className="device-header" />
            <div className="device-sensors" />
            <div className="device-btns" />
            <div className="device-power" />
            <div className="device-home" />
          </div>
        </div>
      )}
    </div>
  );
}
