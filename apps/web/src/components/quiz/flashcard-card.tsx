"use client";

import { getQuestionAnsweredCount } from "@testownik/core/quiz/session";
import type { AnswerRecord, Question } from "@testownik/core/quiz/types";
import {
  CheckIcon,
  ListChecksIcon,
  RotateCwIcon,
  SparklesIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { ImageLoad } from "@/components/image-load";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { isInputElement, isModalOpen } from "@/components/quiz/helpers/dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { cn } from "@/lib/utils";

/** How far the card travels before letting go grades it. */
const SWIPE_THRESHOLD = 110;
/** A shorter move is a tap, which flips the card. */
const TAP_SLOP = 8;
/** The exit animation; the next card arrives when it ends. */
const LEAVE_DURATION = 280;

/**
 * A question as a flashcard: the front asks, a tap or Space flips it to the
 * correct answers and the explanation. Swiping right, the right button or
 * `2` records that the learner knew it; swiping left, the left button or `1`
 * that they did not. Mount it with the question ID as key, so that the next
 * card starts face up and in place.
 */
export function FlashcardCard({
  question,
  answers,
  onGrade,
  onShowAnswers,
}: {
  question: Question;
  answers: AnswerRecord[];
  onGrade: (knew: boolean) => void;
  /** Answers this card as in the quiz instead. */
  onShowAnswers: () => void;
}) {
  const [flipped, setFlipped] = useState(false);
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState<"left" | "right" | null>(null);
  const leavingRef = useRef(false);
  const gesture = useRef<{
    x: number;
    pointerId: number;
    moved: boolean;
  } | null>(null);

  const grade = (knew: boolean) => {
    if (leavingRef.current) {
      return;
    }
    leavingRef.current = true;
    setLeaving(knew ? "right" : "left");
    window.setTimeout(() => {
      onGrade(knew);
    }, LEAVE_DURATION);
  };

  const flip = () => {
    if (!leavingRef.current) {
      setFlipped((value) => !value);
    }
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || leavingRef.current) {
      return;
    }
    gesture.current = {
      x: event.clientX,
      pointerId: event.pointerId,
      moved: false,
    };
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // A synthetic pointer cannot be captured; the swipe still works while
      // the pointer stays over the card.
    }
    setDragging(true);
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (current === null || current.pointerId !== event.pointerId) {
      return;
    }
    const dx = event.clientX - current.x;
    if (Math.abs(dx) > TAP_SLOP) {
      current.moved = true;
    }
    setOffset(dx);
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const current = gesture.current;
    if (current === null || current.pointerId !== event.pointerId) {
      return;
    }
    gesture.current = null;
    setDragging(false);
    const dx = event.clientX - current.x;
    if (Math.abs(dx) >= SWIPE_THRESHOLD) {
      grade(dx > 0);
      return;
    }
    setOffset(0);
    if (!current.moved) {
      flip();
    }
  };

  const onPointerCancel = () => {
    gesture.current = null;
    setDragging(false);
    setOffset(0);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (isInputElement(target) || isModalOpen()) {
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
          flip();
          break;
        }
        case "ArrowLeft":
        case "1": {
          event.preventDefault();
          grade(false);
          break;
        }
        case "ArrowRight":
        case "2": {
          event.preventDefault();
          grade(true);
          break;
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
    // Both handlers read refs, so one registration lasts the card's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const markdown = question.is_markdown_enabled !== false;
  const correct = question.answers.filter((answer) => answer.is_correct);
  const appearances = getQuestionAnsweredCount(question.id, false, answers);
  const knowStrength = Math.min(1, Math.max(0, offset / SWIPE_THRESHOLD));
  const forgetStrength = Math.min(1, Math.max(0, -offset / SWIPE_THRESHOLD));
  const transform =
    leaving === null
      ? `translateX(${String(offset)}px) rotate(${String(offset / 18)}deg)`
      : `translateX(${leaving === "right" ? "140%" : "-140%"}) rotate(${leaving === "right" ? "20" : "-20"}deg)`;

  return (
    <div className="select-none" data-testid="flashcard">
      <div
        className="relative touch-pan-y"
        style={{
          transform,
          opacity: leaving === null ? 1 : 0,
          transition: dragging
            ? "none"
            : `transform ${String(LEAVE_DURATION)}ms ease, opacity ${String(LEAVE_DURATION)}ms ease`,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div className="perspective-distant">
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events -- Pointer events on the parent flip and swipe; the keyboard is handled globally and by the buttons below. */}
          <div
            role="group"
            aria-label={`Fiszka: pytanie ${String(question.order)}, ${flipped ? "odpowiedź" : "pytanie"}`}
            className="grid cursor-grab transition-transform duration-500 transform-3d *:col-start-1 *:row-start-1 active:cursor-grabbing"
            style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
          >
            <section
              aria-hidden={flipped}
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
              className="bg-card text-card-foreground flex min-h-80 rotate-y-180 flex-col gap-4 rounded-xl border p-6 shadow-sm backface-hidden"
            >
              <header className="text-muted-foreground text-sm font-medium">
                {question.type === "open"
                  ? correct.length === 1
                    ? "Poprawna odpowiedź"
                    : "Akceptowane odpowiedzi"
                  : correct.length === 1
                    ? "Poprawna odpowiedź"
                    : "Poprawne odpowiedzi"}
              </header>
              <ul className="flex flex-1 flex-col justify-center gap-2">
                {correct.map((answer) => (
                  <li
                    key={answer.id}
                    className="flex items-start gap-2 rounded-md border border-green-500/40 bg-green-500/10 px-3 py-2 text-green-800 dark:text-green-300"
                  >
                    <CheckIcon
                      className="mt-0.5 size-4 shrink-0"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <MarkdownRenderer className="text-sm" enabled={markdown}>
                        {answer.text}
                      </MarkdownRenderer>
                      <ImageLoad
                        key={`flashcard-answer-image-${answer.id}`}
                        url={answer.image}
                        alt={answer.text}
                        width={answer.image_width}
                        height={answer.image_height}
                        className="mt-1 max-h-40 rounded object-contain"
                      />
                    </div>
                  </li>
                ))}
                {correct.length === 0 ? (
                  <li className="text-muted-foreground text-sm">
                    To pytanie nie ma oznaczonej poprawnej odpowiedzi.
                  </li>
                ) : null}
              </ul>
              {question.explanation != null &&
              question.explanation.trim() !== "" ? (
                <div className="bg-muted/40 rounded-md border p-3 text-sm">
                  <MarkdownRenderer enabled={markdown}>
                    {question.explanation}
                  </MarkdownRenderer>
                </div>
              ) : null}
            </section>
          </div>
        </div>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-5 left-5 -rotate-12 rounded-md border-4 border-red-500 px-3 py-1 text-2xl font-black tracking-wide text-red-500 uppercase"
          style={{ opacity: forgetStrength }}
        >
          Nie umiem
        </span>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-5 right-5 rotate-12 rounded-md border-4 border-green-500 px-3 py-1 text-2xl font-black tracking-wide text-green-500 uppercase"
          style={{ opacity: knowStrength }}
        >
          Umiem
        </span>
      </div>

      <div className="mt-4 flex items-center justify-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="border-red-500/40 text-red-600 hover:bg-red-500/10 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
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
          size="icon-lg"
          onClick={flip}
          aria-label={flipped ? "Pokaż pytanie" : "Pokaż odpowiedź"}
          aria-keyshortcuts="Space"
        >
          <RotateCwIcon
            className={cn(
              "transition-transform duration-500",
              flipped && "rotate-180",
            )}
          />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="border-green-500/40 text-green-700 hover:bg-green-500/10 hover:text-green-800 dark:text-green-400 dark:hover:text-green-300"
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
      <div className="mt-2 flex justify-center">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground"
          onClick={onShowAnswers}
        >
          <ListChecksIcon />
          Odpowiedz jak w quizie
        </Button>
      </div>
    </div>
  );
}
