"use client";

import { getQuestionAnsweredCount } from "@testownik/core/quiz/session";
import type { AnswerRecord, Question } from "@testownik/core/quiz/types";
import { CheckIcon, ChevronDownIcon, SparklesIcon, XIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { AiExplanationCard } from "@/components/ai/ai-explain-card";
import { ImageLoad } from "@/components/image-load";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { isInputElement, isModalOpen } from "@/components/quiz/helpers/dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Kbd } from "@/components/ui/kbd";

/** How far the card travels before letting go grades it. */
const SWIPE_THRESHOLD = 110;
/** A flick this fast, in px/ms, grades a card short of the threshold… */
const FLICK_VELOCITY = 0.5;
/** …once it has moved this far, so that a jittery tap does not. */
const FLICK_MIN_DISTANCE = 40;
/** A shorter move is a tap, which flips the card. */
const TAP_SLOP = 8;
/** Pixels of sideways travel per degree of tilt, for a card held at an edge. */
const TILT_RATE = 18;
/** The pointer samples this recent, in ms, set the release velocity. */
const VELOCITY_WINDOW = 100;
/** The bounds of the exit animation; the next card arrives when it ends. */
const LEAVE_MIN = 180;
const LEAVE_MAX = 360;
/** A card let go short of the threshold springs back, overshooting a little. */
const SETTLE = "transform 420ms cubic-bezier(0.34, 1.56, 0.64, 1)";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A question as a flashcard: the front asks, a tap or Space flips it to the
 * correct answers, the explanation folded away and, with `ai`, an AI
 * explanation on request. Swiping right, the right button or
 * `2` records that the learner knew it; swiping left, the left button or `1`
 * that they did not. The card follows the pointer, tilts around the point
 * where it was grabbed, and a quick flick throws it like a long swipe. Mount
 * it with the question ID as key, so that the next card starts face up and in
 * place.
 */
export function FlashcardCard({
  question,
  answers,
  ai,
  onGrade,
}: {
  question: Question;
  answers: AnswerRecord[];
  /** Offers an AI explanation on the back; null when AI is off. */
  ai: { defaultModel: string | null } | null;
  onGrade: (knew: boolean) => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const [showAiExplanation, setShowAiExplanation] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const leavingRef = useRef(false);
  const leaveTimer = useRef<number | null>(null);
  const onGradeRef = useRef(onGrade);
  const cardRef = useRef<HTMLDivElement>(null);
  const knowRef = useRef<HTMLSpanElement>(null);
  const forgetRef = useRef<HTMLSpanElement>(null);
  // Where the card is, written straight to the DOM: a drag re-renders
  // nothing.
  const position = useRef({ x: 0, y: 0, tilt: 0 });
  const gesture = useRef<{
    pointerId: number;
    /** The pointer position at which the card would sit at rest. */
    originX: number;
    originY: number;
    /** -1 to 1: grabbed at the bottom edge, the middle or the top edge. */
    lever: number;
    moved: boolean;
    samples: { t: number; x: number; y: number }[];
  } | null>(null);

  useEffect(() => {
    onGradeRef.current = onGrade;
  });

  // A card removed mid-swipe, by a mode change or a peer, grades nothing.
  useEffect(
    () => () => {
      if (leaveTimer.current !== null) {
        window.clearTimeout(leaveTimer.current);
      }
    },
    [],
  );

  const place = (x: number, y: number, tilt: number, transition: string) => {
    position.current = { x, y, tilt };
    const card = cardRef.current;
    if (card !== null) {
      card.style.transition = transition;
      card.style.transform = `translate(${String(x)}px, ${String(y)}px) rotate(${String(tilt)}deg)`;
    }
    const strength = Math.min(1, Math.abs(x) / SWIPE_THRESHOLD);
    if (knowRef.current !== null) {
      knowRef.current.style.opacity = String(x > 0 ? strength : 0);
    }
    if (forgetRef.current !== null) {
      forgetRef.current.style.opacity = String(x < 0 ? strength : 0);
    }
  };

  const settle = () => {
    place(0, 0, 0, prefersReducedMotion() ? "transform 150ms ease" : SETTLE);
  };

  /** Throws the card off screen from where it is, carrying its velocity. */
  const grade = (knew: boolean, velocity?: { x: number; y: number }) => {
    if (leavingRef.current) {
      return;
    }
    leavingRef.current = true;
    setLeaving(true);
    const card = cardRef.current;
    const direction = knew ? 1 : -1;
    const { x, y, tilt } = position.current;
    let duration = LEAVE_MIN;
    if (card !== null && prefersReducedMotion()) {
      card.style.transition = `opacity ${String(duration)}ms ease`;
    } else if (card !== null) {
      // Far enough that the tilted card clears the viewport from anywhere.
      const targetX = direction * (window.innerWidth + card.offsetWidth * 1.2);
      const speed = Math.max(Math.abs(velocity?.x ?? 0), 1.2);
      duration = Math.min(
        LEAVE_MAX,
        Math.max(LEAVE_MIN, Math.abs(targetX - x) / speed),
      );
      const drift = Math.max(
        -window.innerHeight / 2,
        Math.min(window.innerHeight / 2, (velocity?.y ?? 0) * duration),
      );
      place(
        targetX,
        y + drift,
        tilt + direction * 15,
        `transform ${String(duration)}ms cubic-bezier(0.25, 0.6, 0.4, 1), opacity ${String(duration)}ms ease-in`,
      );
    }
    if (card !== null) {
      card.style.opacity = "0";
    }
    leaveTimer.current = window.setTimeout(() => {
      leaveTimer.current = null;
      onGradeRef.current(knew);
    }, duration);
  };

  const flip = () => {
    if (!leavingRef.current) {
      setFlipped((value) => !value);
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || leavingRef.current || gesture.current !== null) {
      return;
    }
    // A control on the card does its own thing; it neither flips nor drags.
    if (
      event.target instanceof Element &&
      event.target.closest("button, a, input, textarea, select") !== null
    ) {
      return;
    }
    const card = event.currentTarget;
    // Caught mid-spring, the card stays where it is instead of jumping.
    let { x, y } = position.current;
    try {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(card).transform);
      x = matrix.m41;
      y = matrix.m42;
    } catch {
      // An unparsable transform leaves the last placed position.
    }
    const rect = card.getBoundingClientRect();
    const fromMiddle = Math.max(
      -1,
      Math.min(
        1,
        (rect.top + rect.height / 2 - event.clientY) / (rect.height / 2),
      ),
    );
    gesture.current = {
      pointerId: event.pointerId,
      originX: event.clientX - x,
      originY: event.clientY - y,
      // Held near the middle the card still tilts, just less.
      lever: (fromMiddle < 0 ? -1 : 1) * (0.5 + Math.abs(fromMiddle) / 2),
      moved: false,
      samples: [{ t: event.timeStamp, x: event.clientX, y: event.clientY }],
    };
    try {
      card.setPointerCapture(event.pointerId);
    } catch {
      // A synthetic pointer cannot be captured; the swipe still works while
      // the pointer stays over the card.
    }
    place(x, y, (x / TILT_RATE) * gesture.current.lever, "none");
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (current?.pointerId !== event.pointerId) {
      return;
    }
    const first = current.samples[0];
    const dx = event.clientX - first.x;
    const dy = event.clientY - first.y;
    if (!current.moved && Math.hypot(dx, dy) > TAP_SLOP) {
      // A touch that starts vertically scrolls the page instead.
      if (event.pointerType === "touch" && Math.abs(dy) > Math.abs(dx)) {
        gesture.current = null;
        settle();
        return;
      }
      current.moved = true;
    }
    current.samples.push({
      t: event.timeStamp,
      x: event.clientX,
      y: event.clientY,
    });
    const x = event.clientX - current.originX;
    const y = event.clientY - current.originY;
    place(x, y, (x / TILT_RATE) * current.lever, "none");
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (current?.pointerId !== event.pointerId) {
      return;
    }
    gesture.current = null;
    // The pointer's speed just before release; one that paused first has
    // none.
    const end = { t: event.timeStamp, x: event.clientX, y: event.clientY };
    const start =
      current.samples.find((sample) => end.t - sample.t <= VELOCITY_WINDOW) ??
      end;
    const elapsed = end.t - start.t;
    const velocity =
      elapsed > 0
        ? { x: (end.x - start.x) / elapsed, y: (end.y - start.y) / elapsed }
        : { x: 0, y: 0 };
    const { x } = position.current;
    const toward = Math.sign(velocity.x) === Math.sign(x);
    const fast = Math.abs(velocity.x) >= FLICK_VELOCITY;
    const far = Math.abs(x) >= SWIPE_THRESHOLD;
    // Past the threshold it grades unless pulled back hard; short of it, a
    // flick away from the middle grades too.
    if (
      (far && (toward || !fast)) ||
      (fast && toward && Math.abs(x) >= FLICK_MIN_DISTANCE)
    ) {
      grade(x > 0, velocity);
      return;
    }
    settle();
    if (!current.moved) {
      flip();
    }
  };

  const onPointerCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (gesture.current?.pointerId !== event.pointerId) {
      return;
    }
    gesture.current = null;
    settle();
  };

  // Once a swipe has started, the page must not take the touch over and
  // scroll: that cancels the pointer and drops the card. React listens to
  // touch events passively, so this one is registered by hand.
  useEffect(() => {
    const card = cardRef.current;
    if (card === null) {
      return;
    }
    const handleTouchMove = (event: TouchEvent) => {
      // Decided only once the touch has left the tap slop: a prevented
      // first move would stop a vertical scroll too.
      if (gesture.current?.moved === true) {
        event.preventDefault();
      }
    };
    card.addEventListener("touchmove", handleTouchMove, { passive: false });
    return () => {
      card.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  const keys = useRef({ flip, grade });
  useEffect(() => {
    keys.current = { flip, grade };
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      // A held key must not grade card after card.
      if (event.repeat || isInputElement(target) || isModalOpen()) {
        return;
      }
      const onButton = target.tagName.toLowerCase() === "button";
      switch (event.key) {
        case " ":
        case "Enter": {
          if (onButton) {
            return;
          }
          event.preventDefault();
          keys.current.flip();
          break;
        }
        case "ArrowLeft":
        case "1": {
          event.preventDefault();
          keys.current.grade(false);
          break;
        }
        case "ArrowRight":
        case "2": {
          event.preventDefault();
          keys.current.grade(true);
          break;
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
    // The handler reaches the latest `flip` and `grade` through a ref, so
    // one registration lasts the card's life.
  }, []);

  const markdown = question.is_markdown_enabled !== false;
  const hasExplanation =
    question.explanation != null && question.explanation.trim() !== "";
  // The back lists the correct answers in the author's order, not shuffled.
  const correct = question.answers
    .filter((answer) => answer.is_correct)
    .toSorted((a, b) => a.order - b.order);
  const appearances = getQuestionAnsweredCount(question.id, false, answers);
  return (
    <div className="select-none" data-testid="flashcard">
      {/* Above the neighbouring columns, so that a card dragged or thrown
          sideways passes over the quiz info instead of under it. */}
      {/* Its transform and opacity are written by `place` and `grade`, not
          by React. A touch that starts vertically scrolls the page; one that
          starts sideways is a swipe, and from then on the card follows the
          finger both ways. */}
      <div
        ref={cardRef}
        className="relative z-10 touch-pan-y will-change-transform"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        onLostPointerCapture={onPointerCancel}
        onDragStart={(event) => {
          // A dragged image would take the pointer away from the card.
          event.preventDefault();
        }}
      >
        <div className="perspective-distant">
          <div
            role="group"
            aria-label={`Fiszka: pytanie ${String(question.order)}, ${flipped ? "odpowiedź" : "pytanie"}`}
            className="grid cursor-grab transition-transform duration-500 transform-3d *:col-start-1 *:row-start-1 active:cursor-grabbing"
            style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
          >
            <section
              aria-hidden={flipped}
              inert={flipped}
              className="bg-card text-card-foreground flex min-h-80 flex-col gap-4 rounded-xl border p-6 shadow-sm backface-hidden"
            >
              <header className="text-muted-foreground flex items-center gap-2 text-sm font-medium">
                Pytanie {question.order}.
                <Badge variant="secondary" className="select-none">
                  {appearances}
                </Badge>
                {question.is_ai_generated === true ? (
                  <Badge
                    variant="outline"
                    className="border-primary/20 text-primary/70 ml-auto gap-1 px-1.5"
                  >
                    <SparklesIcon className="size-3" />
                    AI
                  </Badge>
                ) : null}
              </header>
              <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
                <MarkdownRenderer
                  className="text-lg leading-snug font-medium"
                  enabled={markdown}
                >
                  {question.text}
                </MarkdownRenderer>
                <ImageLoad
                  key={`flashcard-image-${question.id}`}
                  url={question.image}
                  alt={question.text}
                  width={question.image_width}
                  height={question.image_height}
                  className="mx-auto max-h-64 rounded border object-contain"
                />
              </div>
              <p className="text-muted-foreground text-center text-xs">
                Dotknij, aby odwrócić · przesuń w prawo, gdy umiesz, w lewo, gdy
                nie
              </p>
            </section>
            <section
              aria-hidden={!flipped}
              inert={!flipped}
              className="bg-card text-card-foreground flex min-h-80 rotate-y-180 flex-col gap-4 rounded-xl border p-6 shadow-sm backface-hidden"
            >
              {/* The question stays in view, small, so the answer reads in context. */}
              <MarkdownRenderer
                className="text-muted-foreground line-clamp-2 text-sm"
                enabled={markdown}
              >
                {question.text}
              </MarkdownRenderer>
              <div className="flex flex-1 flex-col items-center justify-center py-2">
                {correct.length === 1 ? (
                  <div className="flex flex-col items-center gap-4 text-center">
                    <MarkdownRenderer
                      className="text-xl leading-snug font-medium text-balance"
                      enabled={markdown}
                    >
                      {correct[0].text}
                    </MarkdownRenderer>
                    <ImageLoad
                      key={`flashcard-answer-image-${correct[0].id}`}
                      url={correct[0].image}
                      alt={correct[0].text}
                      width={correct[0].image_width}
                      height={correct[0].image_height}
                      className="mx-auto max-h-56 rounded border object-contain"
                    />
                  </div>
                ) : correct.length === 0 ? (
                  <p className="text-muted-foreground text-center text-sm">
                    To pytanie nie ma oznaczonej poprawnej odpowiedzi.
                  </p>
                ) : (
                  <ul className="flex w-full max-w-xl flex-col gap-3">
                    {correct.map((answer) => (
                      <li key={answer.id} className="flex items-start gap-3">
                        <CheckIcon
                          className="mt-1 size-5 shrink-0 text-green-600 dark:text-green-400"
                          aria-hidden="true"
                        />
                        <div className="min-w-0 flex-1">
                          <MarkdownRenderer
                            className="text-lg leading-snug font-medium"
                            enabled={markdown}
                          >
                            {answer.text}
                          </MarkdownRenderer>
                          <ImageLoad
                            key={`flashcard-answer-image-${answer.id}`}
                            url={answer.image}
                            alt={answer.text}
                            width={answer.image_width}
                            height={answer.image_height}
                            className="mt-2 max-h-40 rounded border object-contain"
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {hasExplanation || ai !== null ? (
                <Collapsible className="border-t pt-2">
                  <div className="flex items-center gap-2">
                    {hasExplanation ? (
                      <CollapsibleTrigger
                        render={
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="group/explanation text-muted-foreground -ml-2"
                          />
                        }
                      >
                        Wyjaśnienie
                        <ChevronDownIcon className="transition-transform duration-200 group-data-panel-open/explanation:rotate-180" />
                      </CollapsibleTrigger>
                    ) : null}
                    {ai === null ? null : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-primary -mr-2 ml-auto"
                        disabled={showAiExplanation}
                        onClick={() => {
                          setShowAiExplanation(true);
                        }}
                      >
                        <SparklesIcon />
                        Wyjaśnij z AI
                      </Button>
                    )}
                  </div>
                  {hasExplanation ? (
                    <CollapsibleContent className="h-(--collapsible-panel-height) overflow-hidden transition-[height] duration-200 ease-out data-ending-style:h-0 data-starting-style:h-0">
                      <div className="text-muted-foreground pt-2 text-sm leading-relaxed">
                        <MarkdownRenderer enabled={markdown}>
                          {question.explanation}
                        </MarkdownRenderer>
                      </div>
                    </CollapsibleContent>
                  ) : null}
                </Collapsible>
              ) : null}
            </section>
          </div>
        </div>
        <span
          ref={forgetRef}
          aria-hidden="true"
          className="pointer-events-none absolute top-5 left-5 -rotate-12 rounded-md border-4 border-red-500 px-3 py-1 text-2xl font-black tracking-wide text-red-500 uppercase opacity-0"
        >
          Nie umiem
        </span>
        <span
          ref={knowRef}
          aria-hidden="true"
          className="pointer-events-none absolute top-5 right-5 rotate-12 rounded-md border-4 border-green-500 px-3 py-1 text-2xl font-black tracking-wide text-green-500 uppercase opacity-0"
        >
          Umiem
        </span>
      </div>

      {ai !== null && showAiExplanation && flipped ? (
        <div className="mt-4">
          <AiExplanationCard
            defaultAiModel={ai.defaultModel}
            question={question}
            onClose={() => {
              setShowAiExplanation(false);
            }}
          />
        </div>
      ) : null}

      {/* On a phone the grades stay at the bottom of the screen, under the
          thumb, however long the card. */}
      <div className="bg-background/80 fixed inset-x-0 bottom-0 z-20 flex items-center gap-3 border-t px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:static sm:z-auto sm:mt-4 sm:justify-center sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1 border-red-500/40 text-red-600 hover:bg-red-500/10 hover:text-red-700 sm:flex-none dark:text-red-400 dark:hover:text-red-300"
          disabled={leaving}
          onClick={() => {
            grade(false);
          }}
          aria-keyshortcuts="1 ArrowLeft"
        >
          <XIcon />
          Nie umiem
          <Kbd className="hidden sm:inline-flex">1</Kbd>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="flex-1 border-green-500/40 text-green-700 hover:bg-green-500/10 hover:text-green-800 sm:flex-none dark:text-green-400 dark:hover:text-green-300"
          disabled={leaving}
          onClick={() => {
            grade(true);
          }}
          aria-keyshortcuts="2 ArrowRight"
        >
          <CheckIcon />
          Umiem
          <Kbd className="hidden sm:inline-flex">2</Kbd>
        </Button>
      </div>
    </div>
  );
}
