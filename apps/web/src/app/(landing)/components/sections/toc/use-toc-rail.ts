"use client";

import { useEffect, useEffectEvent, useState } from "react";

import { LANDING_SECTIONS } from "../../landing-sections";
import type { LandingSectionId } from "../../landing-sections";
import { setTocPreviewRailVisible } from "./toc-section-preview";
import { TOC_PREVIEW_ATTRIBUTE } from "./use-toc-preview";

const SHOW_AFTER_SCROLL = 160;
const IDLE_HIDE_DELAY = 2800;
const POINTER_REVEAL_WIDTH = 88;
const POINTER_REVEAL_PADDING = 24;

/**
 * Scroll-spy against a marker a third down the viewport. The rail shows on
 * scroll, near the left edge or on focus, and hides after a while idle.
 */
export function useTocRail(
  navigationReference: React.RefObject<HTMLElement | null>,
  onIdleHide: () => void,
): {
  activeId: LandingSectionId;
  setActiveId: (id: LandingSectionId) => void;
  isVisible: boolean;
} {
  const [activeId, setActiveId] = useState<LandingSectionId>(
    LANDING_SECTIONS[0].id,
  );
  const [isVisible, setIsVisible] = useState(false);
  const handleIdleHide = useEffectEvent(onIdleHide);

  // Dirty peeks are re-cloned in idle time only while the rail is out, so a
  // hover usually finds a current one already parked.
  useEffect(() => {
    setTocPreviewRailVisible(isVisible);
  }, [isVisible]);

  useEffect(() => {
    const sectionElements = LANDING_SECTIONS.flatMap(({ id }) => {
      const element = document.querySelector(`#${CSS.escape(id)}`);
      return element instanceof HTMLElement ? [{ id, element }] : [];
    });

    let frame = 0;
    let hideTimer = 0;
    let isPointerOverNavigation = false;
    let sectionTops: { id: LandingSectionId; top: number }[] = [];
    let pageHeight = 0;

    const clearHideTimer = (): void => {
      if (hideTimer !== 0) {
        window.clearTimeout(hideTimer);
        hideTimer = 0;
      }
    };
    const hideAfterIdle = (focusIsLeaving = false): void => {
      clearHideTimer();
      if (
        isPointerOverNavigation ||
        (!focusIsLeaving &&
          navigationReference.current?.contains(document.activeElement) ===
            true)
      ) {
        return;
      }

      hideTimer = window.setTimeout(() => {
        setIsVisible(false);
        handleIdleHide();
        hideTimer = 0;
      }, IDLE_HIDE_DELAY);
    };

    const revealTemporarily = (): void => {
      setIsVisible(true);
      hideAfterIdle();
    };

    const handleFocusIn = (): void => {
      clearHideTimer();
      setIsVisible(true);
    };
    const handleFocusOut = (event: FocusEvent): void => {
      if (
        event.relatedTarget instanceof Node &&
        navigationReference.current?.contains(event.relatedTarget) === true
      ) {
        return;
      }
      // During focusout the browser can still report the departing link as
      // active. The related target above already tells us focus is leaving.
      hideAfterIdle(true);
    };

    const update = (): void => {
      frame = 0;
      if (window.scrollY > SHOW_AFTER_SCROLL) {
        revealTemporarily();
      }

      const marker = window.innerHeight * 0.34;
      const scrollTop = window.scrollY;
      let nextActiveId: LandingSectionId = LANDING_SECTIONS[0].id;

      for (const section of sectionTops) {
        if (section.top - scrollTop <= marker) {
          nextActiveId = section.id;
        }
      }

      const isAtPageEnd = window.innerHeight + scrollTop >= pageHeight - 2;
      setActiveId(isAtPageEnd ? "footer" : nextActiveId);
    };

    const scheduleUpdate = (): void => {
      if (frame === 0) {
        frame = window.requestAnimationFrame(update);
      }
    };

    // Cached when sizes change, rather than measured on every scroll frame
    // after the hero has changed its styles.
    const measureSections = (): void => {
      const scrollTop = window.scrollY;
      sectionTops = sectionElements.map(({ id, element }) => ({
        id,
        top: element.getBoundingClientRect().top + scrollTop,
      }));
      pageHeight = document.documentElement.scrollHeight;
      scheduleUpdate();
    };
    const sizeObserver = new ResizeObserver(measureSections);
    for (const { element } of sectionElements) {
      sizeObserver.observe(element);
    }
    sizeObserver.observe(document.body);

    const handlePointerMove = (event: PointerEvent): void => {
      const navigation = navigationReference.current;
      if (navigation === null) {
        return;
      }

      const bounds = navigation.getBoundingClientRect();
      const isOverNavigation =
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom;
      const isOverPreview =
        event.target instanceof Element &&
        event.target.closest(`[${TOC_PREVIEW_ATTRIBUTE}]`) !== null;
      const isNearNavigation =
        event.clientX <= POINTER_REVEAL_WIDTH &&
        event.clientY >= bounds.top - POINTER_REVEAL_PADDING &&
        event.clientY <= bounds.bottom + POINTER_REVEAL_PADDING;

      if (isOverNavigation || isOverPreview) {
        isPointerOverNavigation = true;
        clearHideTimer();
        setIsVisible(true);
        return;
      }

      if (isPointerOverNavigation) {
        isPointerOverNavigation = false;
        hideAfterIdle();
      }

      if (isNearNavigation) {
        revealTemporarily();
      }
    };

    measureSections();
    const navigation = navigationReference.current;
    navigation?.addEventListener("focusin", handleFocusIn);
    navigation?.addEventListener("focusout", handleFocusOut);
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", measureSections);
    window.addEventListener("pageshow", measureSections);
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });

    return () => {
      navigation?.removeEventListener("focusin", handleFocusIn);
      navigation?.removeEventListener("focusout", handleFocusOut);
      window.removeEventListener("scroll", scheduleUpdate);
      window.removeEventListener("resize", measureSections);
      window.removeEventListener("pageshow", measureSections);
      sizeObserver.disconnect();
      window.removeEventListener("pointermove", handlePointerMove);
      clearHideTimer();
      if (frame !== 0) {
        window.cancelAnimationFrame(frame);
      }
    };
  }, [navigationReference]);

  return { activeId, setActiveId, isVisible };
}
