import { EraserIcon } from "lucide-react";
import Link from "next/link";
import { Suspense, use, useEffect, useRef, useState } from "react";
import type { PointerEvent, RefObject } from "react";

import { cn } from "@/lib/utils";

import { Peel } from "../../canvasui/peel";
import type { LandingBlogPost } from "../../lib/blog";
import { useMediaQuery } from "../hooks/use-media-query";
import { BLOG_PATH } from "../landing-content";
import { FOCUS_RING } from "../ui/focus";
import { handwritingClassName } from "../ui/handwriting";

// Inline, so only the title's text takes the pointer, not the rest of its
// line or the line box under a short last line. The clamp sits on the item.
const ITEM_LINK_CLASS = cn("pointer-events-auto rounded-sm", FOCUS_RING);

const LIST_CLASS =
  "mt-4 list-disc space-y-2.5 pl-5 text-[1.25rem] leading-[1.22] marker:text-[#80722c]";

/**
 * Before the blog has posts (or when the request fails): say so, and point
 * at the pencil where drawing is on (mouse and pen, as in `UpdateNote`).
 * CSS picks the line, so it matches the server render.
 */
function EmptyNote(): React.JSX.Element {
  return (
    <p className="mt-4 text-[1.25rem] leading-[1.3]">
      Pracujemy nad pierwszymi wpisami.{" "}
      <span className="hidden [@media(hover:hover)_and_(pointer:fine)]:inline">
        Może ty na coś wpadniesz? Spróbuj!
      </span>
      <span className="[@media(hover:hover)_and_(pointer:fine)]:hidden">
        Zajrzyj tu wkrótce.
      </span>
    </p>
  );
}

function PostList({
  posts,
}: {
  posts: Promise<LandingBlogPost[]>;
}): React.JSX.Element {
  const resolved = use(posts);
  if (resolved.length === 0) {
    return <EmptyNote />;
  }
  return (
    <ul className={LIST_CLASS}>
      {resolved.map((post) => (
        <li key={post.slug}>
          <p className="line-clamp-2">
            <Link
              href={`${BLOG_PATH}/${encodeURIComponent(post.slug)}`}
              className={ITEM_LINK_CLASS}
            >
              {post.title}
            </Link>
          </p>
        </li>
      ))}
    </ul>
  );
}

const INK = "#253b60";

/** A pencil whose tip is the hotspot, so the line starts where it points. */
const PENCIL_CURSOR = `url("data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='${INK}' stroke-width='1.8' stroke-linecap='round' stroke-linejoin='round'><path d='M21.17 6.81a2.83 2.83 0 0 0-4-4L3.84 16.17a2 2 0 0 0-.5.83l-1.32 4.35a.5.5 0 0 0 .62.62l4.35-1.32a2 2 0 0 0 .83-.5z' fill='%23fff'/></svg>`,
)}") 2 22, crosshair`;

/**
 * Pen strokes from a mouse, pen or finger, just for fun. It lives on the
 * sheet itself, under the text, so the ink curls away with the paper. Nothing
 * is kept: a resize or reload wipes it. Every coalesced sample goes into the
 * stroke, so fast scribbles stay smooth, and offsets are in the note's own
 * coordinates, so the tilt does not skew the line.
 */
function InkCanvas({
  canvasReference,
  onInk,
}: {
  canvasReference: RefObject<HTMLCanvasElement | null>;
  onInk: () => void;
}): React.JSX.Element {
  const strokeReference = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const canvas = canvasReference.current;
    if (canvas === null) {
      return;
    }
    const resize = (): void => {
      const ratio = window.devicePixelRatio;
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
      const context = canvas.getContext("2d");
      if (context !== null) {
        context.scale(ratio, ratio);
        context.lineCap = "round";
        context.lineJoin = "round";
        context.lineWidth = 2.4;
        context.strokeStyle = INK;
      }
    };
    // Fires once on observe too. Resizing the bitmap wipes the ink.
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => {
      observer.disconnect();
    };
  }, [canvasReference]);

  const draw = (event: PointerEvent<HTMLCanvasElement>): void => {
    const context = canvasReference.current?.getContext("2d");
    const last = strokeReference.current;
    if (context == null || last === null) {
      return;
    }
    // Every sample since the last frame, where supported (Safari 18+).
    const native = event.nativeEvent;
    const samples =
      "getCoalescedEvents" in native ? native.getCoalescedEvents() : [];
    context.beginPath();
    context.moveTo(last.x, last.y);
    let next = last;
    for (const point of samples.length > 0 ? samples : [native]) {
      next = { x: point.offsetX, y: point.offsetY };
      context.lineTo(next.x, next.y);
    }
    context.stroke();
    strokeReference.current = next;
  };

  const end = (): void => {
    strokeReference.current = null;
  };

  return (
    <canvas
      ref={canvasReference}
      aria-hidden="true"
      style={{ cursor: PENCIL_CURSOR }}
      className="absolute inset-0 size-full touch-none"
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return;
        }
        event.currentTarget.setPointerCapture(event.pointerId);
        const { offsetX: x, offsetY: y } = event.nativeEvent;
        strokeReference.current = { x, y };
        // A tap leaves a dot.
        const context = event.currentTarget.getContext("2d");
        context?.beginPath();
        context?.arc(x, y, 1.2, 0, Math.PI * 2);
        context?.stroke();
        onInk();
      }}
      onPointerMove={draw}
      onPointerUp={end}
      onPointerCancel={end}
    />
  );
}

/** The sticky note under the story heading: the latest blog posts. */
export function UpdateNote({
  posts,
}: {
  posts: Promise<LandingBlogPost[]>;
}): React.JSX.Element {
  const inkReference = useRef<HTMLCanvasElement>(null);
  const [hasInk, setHasInk] = useState(false);
  // Mouse and pen only: on touch the note would swallow the page's scroll.
  const canDraw = useMediaQuery("(hover: hover) and (pointer: fine)");
  const showEraser = canDraw && hasInk;

  return (
    <article
      aria-labelledby="landing-update-heading"
      className="max-w-sm -rotate-[1.5deg] px-2 lg:mt-10"
    >
      <Peel
        reverse
        corner
        side="bottom"
        reveal={36}
        curl={34}
        bow={12}
        bulge={0}
        shine={0}
        shade={0.3}
        className="lp-update-note"
        overlay={
          // The text sits above the sheet and lets strokes through to the
          // ink; only the links and the eraser take the pointer.
          <div
            className={cn(
              handwritingClassName,
              "lp-update-paper pointer-events-none relative flex h-full flex-col px-6 pt-5 pb-14 text-[#253b60] sm:px-7",
            )}
          >
            <h3
              id="landing-update-heading"
              className="text-[2.1rem] leading-none font-bold tracking-tight"
            >
              Ostatnie zmiany
            </h3>
            <Suspense fallback={null}>
              <PostList posts={posts} />
            </Suspense>
            <p className="mt-3 flex min-h-11 items-center text-[1.35rem] font-semibold">
              <Link
                href={BLOG_PATH}
                className={cn(
                  "lp-ink-link pointer-events-auto rounded-sm",
                  FOCUS_RING,
                )}
              >
                Zobacz więcej
              </Link>
            </p>
            {/* A paper tag over the scribble, so it never drowns in ink. */}
            <button
              type="button"
              aria-label="Zmaż rysunek"
              inert={!showEraser}
              onClick={() => {
                const canvas = inkReference.current;
                canvas
                  ?.getContext("2d")
                  ?.clearRect(0, 0, canvas.width, canvas.height);
                setHasInk(false);
              }}
              className={cn(
                "absolute top-4 right-5 grid size-10 origin-center place-items-center rounded-lg bg-[#fdf5c4] shadow-[0_3px_8px_-3px_rgb(99_88_29/45%)] sm:right-6",
                "transition-[opacity,scale,rotate] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                showEraser
                  ? "pointer-events-auto scale-100 rotate-0 opacity-100"
                  : "pointer-events-none scale-75 rotate-[-6deg] opacity-0",
                FOCUS_RING,
              )}
            >
              <EraserIcon aria-hidden="true" className="size-5" />
            </button>
          </div>
        }
      >
        <div className="lp-update-sheet relative">
          {canDraw ? (
            <InkCanvas
              canvasReference={inkReference}
              onInk={() => {
                setHasInk(true);
              }}
            />
          ) : null}
        </div>
      </Peel>
    </article>
  );
}
