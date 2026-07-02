"use client";

/* This module is a slide registry: it intentionally co-locates the slide
   components with the `SLIDE_REGISTRY` lookup that the config references.
   Fast-refresh's "only export components" rule doesn't apply to this pattern. */
/* eslint-disable react-refresh/only-export-components */
import formbricks from "@formbricks/js";
import type { CSSProperties, ComponentType } from "react";
import { SiGithub } from "react-icons/si";

import { MarkdownRenderer } from "@/components/markdown-renderer";
import type { WrappedStoryData } from "@/types/wrapped";

import { CountUp, TimeCountUp } from "../components/count-up";
import { formatStudyDuration, peakHourLabel, personaForHour } from "../derived";
import { formatValue } from "../format";
import { FORMBRICKS_SURVEY_ACTION, GITHUB_URL } from "../wrapped.config";
import type { SlideId } from "../wrapped.config";

export interface SlideProps {
  data: WrappedStoryData;
  onShare: () => void;
  onRestart: () => void;
}

const FD = "var(--fd)";
const FM = "var(--fm)";
const HL = "var(--hl)";
const muted = (pct: number) =>
  `color-mix(in srgb, currentColor ${String(pct)}%, transparent)`;

const HOUR_BUCKETS = Array.from({ length: 24 }, (_, hour) => hour);

const int = (n: number) => formatValue(n, "int");
const isGlobalStory = (data: WrappedStoryData) => data.is_global === true;
const volumeHeroFontSize = (value: number) => {
  const length = int(value).length;

  if (length >= 11) {
    return "clamp(42px, 13vw, 66px)";
  }
  if (length >= 10) {
    return "clamp(46px, 14.5vw, 72px)";
  }
  if (length >= 9) {
    return "clamp(54px, 17vw, 86px)";
  }
  if (length >= 8) {
    return "clamp(62px, 21vw, 104px)";
  }
  return "clamp(72px,26vw,124px)";
};

interface SummaryItem {
  val: string;
  label: string;
  highlight: boolean;
  compact?: boolean;
}

function summaryValueStyle(item: SummaryItem): CSSProperties {
  const length = item.val.length;
  const compact = item.compact === true || length > 16;
  const fontSize =
    length >= 34
      ? "clamp(11px, 1.8dvh, 13px)"
      : length >= 26
        ? "clamp(12px, 1.95dvh, 14px)"
        : length >= 20
          ? "clamp(13px, 2.1dvh, 15px)"
          : compact
            ? "clamp(13px, 2.25dvh, 17px)"
            : "clamp(20px, 3.2dvh, 26px)";

  return {
    fontFamily: FD,
    fontSize,
    lineHeight: compact ? 1.04 : 0.98,
    color: item.highlight ? HL : "currentColor",
    overflow: "hidden",
    display: "-webkit-box",
    WebkitLineClamp: length >= 34 ? 4 : length >= 24 ? 3 : compact ? 2 : 1,
    WebkitBoxOrient: "vertical",
    overflowWrap: "anywhere",
    wordBreak: "break-word",
  };
}

/** Bordered stat chip used on a few slides. */
function StatBox({ value, label }: { value: string; label: string }) {
  return (
    <div
      style={{
        border: `1.5px solid ${muted(26)}`,
        borderRadius: "14px",
        padding: "15px 20px",
      }}
    >
      <div style={{ fontFamily: FD, fontSize: "32px", lineHeight: 1 }}>
        {value}
      </div>
      <div
        style={{
          fontFamily: FM,
          fontSize: "12px",
          color: muted(62),
          marginTop: "4px",
        }}
      >
        {label}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ intro */
function IntroSlide({ data }: SlideProps) {
  const global = isGlobalStory(data);

  return (
    <div
      data-screen-label="Intro"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        textAlign: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          animation: "wr-rise .6s .05s both",
          fontFamily: FM,
          fontSize: "13px",
          letterSpacing: ".22em",
          textTransform: "uppercase",
          color: HL,
          marginBottom: "20px",
          fontWeight: 600,
        }}
      >
        {data.season.label}
      </div>
      <h1
        style={{
          animation: "wr-rise .6s .15s both",
          fontFamily: FD,
          fontSize: "clamp(58px,17vw,84px)",
          lineHeight: 0.9,
          letterSpacing: ".01em",
          margin: 0,
          textTransform: "uppercase",
        }}
      >
        {global ? "Cały" : "Twój"}
        <br />
        {global ? "Testownik" : "semestr"}
        <br />
        <span
          style={{
            display: "inline-block",
            background: HL,
            color: "var(--slide-bg, #15171c)",
            padding: "0 .14em",
            transform: "rotate(-2deg)",
          }}
        >
          {global ? "w semestrze" : "w liczbach"}
        </span>
      </h1>
      <p
        style={{
          animation: "wr-rise .6s .3s both",
          fontFamily: FM,
          fontSize: "15px",
          color: muted(65),
          margin: "26px 0 0",
          letterSpacing: ".02em",
        }}
      >
        {data.season.date_range}
      </p>
      <div
        style={{
          animation: "wr-rise .6s .5s both",
          marginTop: "40px",
          fontFamily: FM,
          fontSize: "13px",
          letterSpacing: ".04em",
          color: muted(60),
        }}
      >
        <span style={{ animation: "wr-blink 1.4s steps(1) infinite" }}>▍</span>{" "}
        dotknij, aby zacząć →
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- time */
function TimeSlide({ data }: SlideProps) {
  const global = isGlobalStory(data);
  return (
    <div
      data-screen-label="Czas nauki"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        textAlign: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          animation: "wr-rise .5s .05s both",
          fontFamily: FM,
          fontSize: "13px",
          letterSpacing: ".22em",
          textTransform: "uppercase",
          color: HL,
          marginBottom: "16px",
          fontWeight: 600,
        }}
      >
        {global ? "Czas całej platformy" : "Czas w Testowniku"}
      </div>
      <h2
        style={{
          animation: "wr-rise .5s .12s both",
          fontFamily: FM,
          fontSize: "20px",
          fontWeight: 600,
          lineHeight: 1.2,
          margin: 0,
          maxWidth: "22ch",
          opacity: 0.9,
        }}
      >
        {global
          ? "W tym semestrze spędzono nad nauką"
          : "W tym semestrze spędziłeś nad nauką"}
      </h2>
      <div
        style={{
          animation: "wr-pop .55s .2s both",
          fontFamily: FD,
          fontSize: "clamp(52px,17vw,84px)",
          lineHeight: 0.9,
          letterSpacing: ".01em",
          margin: "14px 0 0",
          textTransform: "uppercase",
        }}
      >
        <TimeCountUp minutes={data.study_time.total_minutes} />
      </div>
      <div
        style={{
          animation: "wr-pop .55s .34s both",
          marginTop: "28px",
          display: "inline-flex",
          alignItems: "center",
          gap: "10px",
          background: HL,
          color: "var(--slide-bg, #15171c)",
          padding: "11px 18px",
          borderRadius: "99px",
        }}
      >
        <span style={{ fontFamily: FD, fontSize: "26px", lineHeight: 1 }}>
          ≈ {Math.round(data.study_time.total_minutes / 20)}
        </span>
        <span
          style={{
            fontFamily: FM,
            fontSize: "13px",
            fontWeight: 600,
            textAlign: "left",
            lineHeight: 1.15,
          }}
        >
          rundek w
          <br />
          lige
        </span>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- volume */
function VolumeSlide({ data }: SlideProps) {
  const global = isGlobalStory(data);

  return (
    <div
      data-screen-label="Pytania i sesje"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        textAlign: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          animation: "wr-rise .5s .05s both",
          fontFamily: FM,
          fontSize: "13px",
          letterSpacing: ".22em",
          textTransform: "uppercase",
          color: HL,
          marginBottom: "12px",
          fontWeight: 600,
        }}
      >
        {global ? "Odpowiedzi na Testowniku" : "Liczba odpowiedzi"}
      </div>
      <h2
        style={{
          animation: "wr-rise .5s .12s both",
          fontFamily: FM,
          fontSize: "20px",
          fontWeight: 600,
          margin: 0,
          opacity: 0.9,
        }}
      >
        {global
          ? "W całym Testowniku kliknięto odpowiedzi"
          : "Kliknięto odpowiedzi"}
      </h2>
      <div
        style={{
          animation: "wr-pop .55s .2s both",
          fontFamily: FD,
          fontSize: volumeHeroFontSize(data.volume.total_answers),
          lineHeight: 0.86,
          letterSpacing: ".005em",
          margin: "6px 0 0",
          textWrap: "nowrap",
          whiteSpace: "nowrap",
        }}
      >
        <CountUp value={data.volume.total_answers} format="int" />
      </div>
      <div
        style={{
          animation: "wr-rise .5s .3s both",
          fontFamily: FD,
          fontSize: "24px",
          marginTop: "2px",
          textTransform: "uppercase",
        }}
      >
        razy.
      </div>
      <div
        style={{
          animation: "wr-rise .5s .42s both",
          display: "flex",
          gap: "12px",
          marginTop: "34px",
        }}
      >
        <StatBox value={int(data.volume.sessions)} label="sesji nauki" />
        <StatBox
          value={`~${String(data.volume.answers_per_session)}`}
          label="pytań / sesję"
        />
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- accuracy */
function AccuracySlide({ data }: SlideProps) {
  const global = isGlobalStory(data);
  const correct = Math.round(data.accuracy.percent);
  return (
    <div
      data-screen-label="Skuteczność"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        textAlign: "left",
      }}
    >
      <div
        style={{
          animation: "wr-rise .5s .05s both",
          fontFamily: FM,
          fontSize: "13px",
          letterSpacing: ".22em",
          textTransform: "uppercase",
          color: HL,
          marginBottom: "10px",
          fontWeight: 600,
        }}
      >
        {global ? "Jak odpowiadaliście?" : "Twoja odpowiedzi"}
      </div>
      <div
        style={{
          animation: "wr-pop .55s .15s both",
          fontFamily: FD,
          fontSize: "clamp(76px,27vw,128px)",
          lineHeight: 0.82,
          letterSpacing: ".005em",
        }}
      >
        <CountUp value={data.accuracy.percent} format="pct" />
      </div>
      <div
        style={{
          animation: "wr-rise .6s .3s both",
          display: "grid",
          gridTemplateColumns: "repeat(20, 1fr)",
          gap: "6px",
          margin: "24px 0 18px",
        }}
      >
        {Array.from({ length: 100 }, (_, index) => (
          <span
            key={index}
            style={{
              aspectRatio: "1 / 1",
              borderRadius: "50%",
              background: index < correct ? "currentColor" : "var(--red)",
              animation: `wr-bub .34s ${(index * 0.004).toFixed(3)}s both`,
            }}
          />
        ))}
      </div>
      <div
        style={{
          animation: "wr-rise .5s .5s both",
          display: "flex",
          gap: "20px",
          fontFamily: FM,
          fontSize: "14px",
        }}
      >
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              width: "11px",
              height: "11px",
              borderRadius: "50%",
              background: "currentColor",
            }}
          />
          <b>{int(data.accuracy.correct)}</b>&nbsp;dobrze
        </span>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: "7px",
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              width: "11px",
              height: "11px",
              borderRadius: "50%",
              background: "var(--red)",
            }}
          />
          <b>{int(data.accuracy.wrong)}</b>&nbsp;źle
        </span>
      </div>
      <p
        style={{
          animation: "wr-rise .5s .58s both",
          fontSize: "15px",
          color: muted(64),
          margin: "16px 0 0",
        }}
      >
        Za <b style={{ color: "currentColor" }}>pierwszym podejściem</b>{" "}
        {global ? "trafiano w " : "trafiałeś w "}
        <b style={{ color: "currentColor" }}>
          {data.accuracy.first_attempt_percent}%
        </b>{" "}
        pytań.
      </p>
    </div>
  );
}

/* ---------------------------------------------------------------- rhythm */
function RhythmSlide({ data }: SlideProps) {
  const global = isGlobalStory(data);
  const persona = personaForHour(data.rhythm.peak_hour, {
    isGlobal: global,
  });

  return (
    <div
      data-screen-label="Godziny aktywności"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        textAlign: "left",
      }}
    >
      <div
        style={{
          animation: "wr-rise .5s .05s both",
          fontFamily: FM,
          fontSize: "13px",
          letterSpacing: ".22em",
          textTransform: "uppercase",
          color: HL,
          marginBottom: "12px",
          fontWeight: 600,
        }}
      >
        Godziny aktywności
      </div>
      <h2
        style={{
          animation: "wr-rise .5s .12s both",
          fontFamily: FD,
          fontSize: "clamp(34px,10vw,46px)",
          lineHeight: 0.96,
          margin: "0 0 4px",
          textTransform: "uppercase",
        }}
      >
        Najwięcej
        <br />
        {global ? "odpowiadano o " : "odpowiadasz o "}
        <span style={{ color: HL }}>
          {peakHourLabel(data.rhythm.peak_hour)}
        </span>
      </h2>
      <div
        style={{
          animation: "wr-rise .6s .25s both",
          display: "flex",
          alignItems: "flex-end",
          gap: "3px",
          height: "124px",
          margin: "24px 0 6px",
        }}
      >
        {HOUR_BUCKETS.map((hour) => {
          const total = data.rhythm.hours[hour] ?? 0;
          const correct = data.rhythm.correct_hours[hour] ?? 0;
          return (
            <div
              key={`hour-${String(hour).padStart(2, "0")}`}
              style={{
                flex: 1,
                height: "100%",
                position: "relative",
                transformOrigin: "bottom",
                animation: "wr-grow .7s cubic-bezier(.2,.7,.2,1) both",
                animationDelay: `${(hour * 0.018 + 0.25).toFixed(3)}s`,
              }}
            >
              {/* All answers (behind). */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: `${String(total)}%`,
                  background: muted(24),
                  borderRadius: "3px 3px 0 0",
                }}
              />
              {/* Correct answers (front). */}
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: 0,
                  height: `${String(correct)}%`,
                  background: HL,
                  borderRadius: "3px 3px 0 0",
                }}
              />
            </div>
          );
        })}
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          fontFamily: FM,
          fontSize: "10px",
          color: muted(55),
        }}
      >
        <span>00</span>
        <span>06</span>
        <span>12</span>
        <span>18</span>
        <span>23</span>
      </div>
      <div
        style={{
          animation: "wr-rise .5s .4s both",
          display: "flex",
          gap: "16px",
          marginTop: "12px",
          fontFamily: FM,
          fontSize: "11px",
          color: muted(64),
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "2px",
              background: muted(30),
            }}
          />
          wszystkie
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "2px",
              background: HL,
            }}
          />
          poprawne
        </span>
      </div>
      <div
        style={{
          animation: "wr-rise .5s .55s both",
          marginTop: "20px",
          borderLeft: `3px solid ${HL}`,
          padding: "2px 0 2px 16px",
          maxWidth: "27ch",
        }}
      >
        <div
          style={{
            fontFamily: FM,
            fontSize: "12px",
            color: muted(58),
            letterSpacing: ".1em",
            textTransform: "uppercase",
          }}
        >
          {global ? "Typ semestru" : "Twój typ"}
        </div>
        <div
          style={{
            fontFamily: FD,
            fontSize: "30px",
            textTransform: "uppercase",
            marginTop: "3px",
          }}
        >
          {persona.name}
        </div>
        <div
          style={{
            fontSize: "15px",
            color: muted(70),
            marginTop: "4px",
          }}
        >
          {persona.description}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------- top */
function TopSlide({ data }: SlideProps) {
  const global = isGlobalStory(data);
  const max = data.top_quizzes[0]?.value || 1;
  return (
    <div
      data-screen-label="Top quizy"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        textAlign: "left",
      }}
    >
      <div
        style={{
          animation: "wr-rise .5s .05s both",
          fontFamily: FM,
          fontSize: "13px",
          letterSpacing: ".22em",
          textTransform: "uppercase",
          color: HL,
          marginBottom: "8px",
          fontWeight: 600,
        }}
      >
        {global ? "Najdłużej rozwiązywane" : "Najwięcej czasu"}
      </div>
      <h2
        style={{
          animation: "wr-rise .5s .12s both",
          fontFamily: FD,
          fontSize: "clamp(38px,11vw,52px)",
          letterSpacing: ".005em",
          margin: "0 0 22px",
          textTransform: "uppercase",
        }}
      >
        {global ? "Top quizy Testownika" : "Twoje top quizy"}
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
        {data.top_quizzes.map((q, index) => (
          <div
            key={q.rank}
            style={{
              animation: "wr-rise .5s both",
              animationDelay: `${(0.18 + index * 0.08).toFixed(2)}s`,
            }}
          >
            <div
              style={{ display: "flex", alignItems: "baseline", gap: "12px" }}
            >
              <span
                style={{
                  fontFamily: FD,
                  fontSize: "20px",
                  color: HL,
                  width: "24px",
                }}
              >
                {q.rank}
              </span>
              <span
                style={{
                  flex: 1,
                  fontFamily: FM,
                  fontSize: "16px",
                  fontWeight: 600,
                  lineHeight: 1.2,
                }}
              >
                {q.name}
              </span>
              <span
                style={{ fontFamily: FM, fontSize: "13px", color: muted(62) }}
              >
                {formatStudyDuration(q.value)}
              </span>
            </div>
            <div
              style={{
                height: "7px",
                background: muted(16),
                borderRadius: "4px",
                margin: "8px 0 0 36px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  height: "100%",
                  background: HL,
                  borderRadius: "4px",
                  width: `${String(Math.round((q.value / max) * 100))}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- hardest */
function HardestSlide({ data }: SlideProps) {
  const global = isGlobalStory(data);
  const q = data.hardest_question;
  if (q == null) {
    return null;
  }
  const hasImage = q.image != null && q.image !== "";
  return (
    <div
      data-screen-label="Najtrudniejsze pytanie"
      style={{
        height: "100%",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        transform: "translateY(clamp(-44px, -5dvh, -20px))",
        textAlign: "left",
      }}
    >
      {/* Faint floating "trauma" labels behind the content. */}
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: "3%",
          right: "-4%",
          transform: "rotate(-8deg)",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            display: "block",
            fontFamily: FD,
            fontSize: "clamp(60px,22vw,120px)",
            textTransform: "uppercase",
            opacity: 0.08,
            animation: "wr-float 7s ease-in-out infinite",
          }}
        >
          PTSD
        </span>
      </span>
      <span
        aria-hidden
        style={{
          position: "absolute",
          bottom: "10%",
          left: "-3%",
          transform: "rotate(6deg)",
          pointerEvents: "none",
        }}
      >
        <span
          style={{
            display: "block",
            fontFamily: FD,
            fontSize: "clamp(24px,7.5vw,42px)",
            textTransform: "uppercase",
            opacity: 0.1,
            animation: "wr-float 6s ease-in-out 0.4s infinite",
          }}
        >
          flashbacki z wietnamu
        </span>
      </span>

      <div style={{ position: "relative", zIndex: 1 }}>
        <div
          style={{
            animation: "wr-rise .5s .05s both",
            fontFamily: FM,
            fontSize: "13px",
            letterSpacing: ".22em",
            textTransform: "uppercase",
            color: HL,
            marginBottom: "10px",
            fontWeight: 600,
          }}
        >
          {global ? "Koszmar semestru" : "Twój koszmar"}
        </div>
        <h2
          style={{
            animation: "wr-rise .5s .12s both",
            fontFamily: FD,
            fontSize: "clamp(26px,8vw,38px)",
            lineHeight: 0.94,
            margin: "0 0 16px",
            textTransform: "uppercase",
            maxWidth: global ? "16ch" : "14ch",
          }}
        >
          {global
            ? "Pytanie, które najczęściej dawało popalić"
            : "Pytanie, które dało Ci popalić"}
        </h2>
        <div
          style={{
            animation: "wr-pop .5s .24s both",
            background: "var(--paper)",
            color: "#15171c",
            padding: "20px 20px",
            borderRadius: "18px",
            position: "relative",
            boxShadow:
              "8px 8px 0 color-mix(in srgb, var(--slide-fg,#000) 22%, transparent)",
          }}
        >
          <div
            style={{
              fontFamily: FM,
              fontSize: "11px",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              color: "var(--red)",
              marginBottom: "10px",
              fontWeight: 700,
            }}
          >
            Pytanie #{q.question_number} · quiz {q.quiz_name}
          </div>
          {/* Markdown so code / formatting renders; clamped so a long
              question (with code blocks) can't blow out the card. */}
          <div
            style={{
              position: "relative",
              maxHeight: hasImage ? "116px" : "210px",
              overflow: "hidden",
              fontFamily: FM,
              fontWeight: 600,
              color: "#15171c",
            }}
          >
            <MarkdownRenderer
              className={
                "max-w-none text-[17px] leading-snug text-[#15171c] " +
                "prose-p:text-[#15171c] prose-strong:text-[#15171c] " +
                "prose-code:text-[#15171c] prose-pre:text-[#15171c] prose-pre:bg-neutral-100 " +
                "prose-p:my-1 prose-pre:my-2 prose-pre:text-[13px] " +
                "prose-pre:rounded-lg prose-code:text-[13px]"
              }
            >
              {q.text}
            </MarkdownRenderer>
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: -10,
                height: "26px",
                background: "linear-gradient(transparent, var(--paper))",
              }}
            />
          </div>
          {hasImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={q.image ?? ""}
              alt=""
              style={{
                display: "block",
                width: "100%",
                maxHeight: "132px",
                objectFit: "contain",
                borderRadius: "10px",
                background: "#f1f1f1",
                marginTop: "12px",
              }}
            />
          ) : null}
          <div
            style={{
              marginTop: "12px",
              display: "flex",
              alignItems: "center",
              gap: "22px",
            }}
          >
            <div
              style={{ display: "flex", alignItems: "baseline", gap: "8px" }}
            >
              <span
                style={{
                  fontFamily: FD,
                  fontSize: "40px",
                  color: "var(--red)",
                  lineHeight: 1,
                }}
              >
                {q.wrong_count}×
              </span>
              <span style={{ fontFamily: FM, fontSize: "14px", color: "#555" }}>
                źle
              </span>
            </div>
            <div
              style={{ display: "flex", alignItems: "baseline", gap: "8px" }}
            >
              <span
                style={{
                  fontFamily: FD,
                  fontSize: "40px",
                  color: "#1f9e57",
                  lineHeight: 1,
                }}
              >
                {q.correct_count}×
              </span>
              <span style={{ fontFamily: FM, fontSize: "14px", color: "#555" }}>
                dobrze
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------- creator */
function CreatorSlide({ data }: SlideProps) {
  const c = data.creator_impact;
  if (c == null) {
    return null;
  }
  return (
    <div
      data-screen-label="Twoje quizy u innych"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        textAlign: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          animation: "wr-rise .5s .05s both",
          fontFamily: FM,
          fontSize: "13px",
          letterSpacing: ".22em",
          textTransform: "uppercase",
          color: HL,
          marginBottom: "14px",
          fontWeight: 600,
        }}
      >
        Twoje quizy u innych
      </div>
      <h2
        style={{
          animation: "wr-rise .5s .12s both",
          fontFamily: FM,
          fontSize: "20px",
          fontWeight: 600,
          lineHeight: 1.2,
          margin: 0,
          maxWidth: "18ch",
          opacity: 0.92,
        }}
      >
        Twoje quizy uczą innych
      </h2>
      <div
        style={{
          animation: "wr-pop .55s .22s both",
          fontFamily: FD,
          fontSize: "clamp(82px,30vw,140px)",
          lineHeight: 0.86,
          margin: "14px 0 0",
        }}
      >
        <CountUp value={c.people} format="int" />
      </div>
      <div
        style={{
          animation: "wr-rise .5s .3s both",
          fontFamily: FD,
          fontSize: "24px",
          textTransform: "uppercase",
        }}
      >
        osoby
      </div>
      <div
        style={{
          animation: "wr-rise .5s .42s both",
          display: "flex",
          gap: "12px",
          marginTop: "30px",
        }}
      >
        <StatBox value={int(c.answers)} label="odpowiedzi" />
        <StatBox value={`${String(c.hours)} godz`} label="spędzili łącznie" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ rank */
function RankSlide({ data }: SlideProps) {
  return (
    <div
      data-screen-label="Ranking"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        textAlign: "center",
        alignItems: "center",
      }}
    >
      <div
        style={{
          animation: "wr-rise .5s .05s both",
          fontFamily: FM,
          fontSize: "13px",
          letterSpacing: ".22em",
          textTransform: "uppercase",
          color: HL,
          marginBottom: "16px",
          fontWeight: 600,
        }}
      >
        Na tle innych
      </div>
      <h2
        style={{
          animation: "wr-rise .5s .12s both",
          fontFamily: FM,
          fontSize: "20px",
          fontWeight: 600,
          margin: 0,
          opacity: 0.9,
        }}
      >
        Jesteś w
      </h2>
      <div
        style={{
          animation: "wr-pop .55s .2s both",
          display: "flex",
          alignItems: "baseline",
          gap: "10px",
        }}
      >
        <span
          style={{
            fontFamily: FD,
            fontSize: "clamp(72px,28vw,132px)",
            lineHeight: 0.86,
            textTransform: "uppercase",
          }}
        >
          top
        </span>
        <span
          style={{
            fontFamily: FD,
            fontSize: "clamp(72px,28vw,132px)",
            lineHeight: 0.86,
            color: HL,
          }}
        >
          <CountUp value={data.rank.top_percent} format="pct" />
        </span>
      </div>
      <p
        style={{
          animation: "wr-rise .5s .34s both",
          fontSize: "18px",
          color: muted(72),
          margin: "12px auto 30px",
          maxWidth: "26ch",
        }}
      >
        najwytrwalszych studentów na Testowniku w tym semestrze.
      </p>
      <div
        style={{
          animation: "wr-rise .5s .46s both",
          width: "100%",
          maxWidth: "300px",
        }}
      >
        <div
          style={{
            position: "relative",
            height: "10px",
            background: muted(16),
            borderRadius: "6px",
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${String(data.rank.percentile_fill)}%`,
              background: HL,
              borderRadius: "6px",
              animation: "wr-wipe .8s .5s both",
            }}
          />
          <div
            style={{
              position: "absolute",
              left: `${String(data.rank.percentile_fill)}%`,
              top: "50%",
              width: "18px",
              height: "18px",
              borderRadius: "50%",
              background: "var(--slide-bg,#15171c)",
              border: `3px solid ${HL}`,
              transform: "translate(-50%,-50%)",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: FM,
            fontSize: "11px",
            color: muted(55),
            marginTop: "8px",
          }}
        >
          <span>reszta</span>
          <span style={{ color: HL }}>Ty</span>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- outro */
function OutroSlide({ data, onShare, onRestart }: SlideProps) {
  const global = isGlobalStory(data);
  const persona = personaForHour(data.rhythm.peak_hour, {
    isGlobal: global,
  });
  const topQuizName = data.top_quizzes[0]?.name ?? "brak danych";
  const summary: SummaryItem[] = global
    ? [
        {
          val: `${String(Math.floor(data.study_time.total_minutes / 60))} godz`,
          label: "czasu nauki",
          highlight: false,
        },
        {
          val: int(data.volume.total_answers),
          label: "pytań",
          highlight: true,
        },
        {
          val: `${String(data.accuracy.percent)}%`,
          label: "skuteczność",
          highlight: false,
        },
        { val: int(data.volume.sessions), label: "sesji", highlight: true },
        {
          val: persona.name,
          label: "rytm semestru",
          highlight: false,
          compact: true,
        },
        {
          val: topQuizName,
          label: "najdłuższy quiz",
          highlight: true,
          compact: true,
        },
      ]
    : [
        {
          val: `${String(Math.floor(data.study_time.total_minutes / 60))} godz`,
          label: "czasu nauki",
          highlight: false,
        },
        {
          val: int(data.volume.total_answers),
          label: "pytań",
          highlight: true,
        },
        {
          val: `${String(data.accuracy.percent)}%`,
          label: "skuteczność",
          highlight: false,
        },
        { val: int(data.volume.sessions), label: "sesji", highlight: true },
        {
          val: `top ${String(data.rank.top_percent)}%`,
          label: "najwytrwalszych",
          highlight: false,
        },
        {
          val: persona.name,
          label: "Twój typ",
          highlight: true,
          compact: true,
        },
      ];

  return (
    <div
      data-screen-label="Podsumowanie"
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        textAlign: "left",
      }}
    >
      <h2
        style={{
          animation: "wr-rise .5s .12s both",
          fontFamily: FD,
          fontSize: "clamp(34px, 7dvh, 54px)",
          lineHeight: 0.96,
          letterSpacing: ".005em",
          margin: "0 0 clamp(10px, 1.8dvh, 20px)",
          textTransform: "uppercase",
        }}
      >
        {global ? "Taki był Testownik" : "Taki był Twój semestr"}
      </h2>
      <div
        style={{
          animation: "wr-pop .5s .22s both",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "1px",
          background: muted(20),
          border: `1px solid ${muted(20)}`,
          borderRadius: "14px",
          overflow: "hidden",
        }}
      >
        {summary.map((s) => (
          <div
            key={s.label}
            style={{
              background: "var(--slide-bg, #15171c)",
              padding: "clamp(9px, 1.7dvh, 16px)",
            }}
          >
            <div style={summaryValueStyle(s)}>{s.val}</div>
            <div
              style={{
                fontFamily: FM,
                fontSize: "clamp(9px, 1.5dvh, 11px)",
                color: muted(62),
                marginTop: "clamp(2px, .6dvh, 5px)",
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>
      <div
        style={{
          animation: "wr-rise .5s .4s both",
          display: "flex",
          gap: "10px",
          marginTop: "clamp(12px, 2.3dvh, 24px)",
          pointerEvents: "auto",
        }}
      >
        <button
          type="button"
          onClick={onShare}
          style={{
            flex: 1,
            height: "clamp(38px, 5.4dvh, 46px)",
            border: "none",
            borderRadius: "12px",
            background: HL,
            color: "var(--slide-bg, #15171c)",
            fontFamily: FM,
            fontSize: "clamp(13px, 1.9dvh, 15px)",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          Udostępnij
        </button>
        <button
          type="button"
          onClick={onRestart}
          style={{
            flex: 1,
            height: "clamp(38px, 5.4dvh, 46px)",
            borderRadius: "12px",
            background: "transparent",
            border: "1.5px solid currentColor",
            color: "currentColor",
            fontFamily: FM,
            fontSize: "clamp(13px, 1.9dvh, 15px)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Od nowa
        </button>
      </div>
      <div
        style={{
          animation: "wr-rise .5s .5s both",
          display: "flex",
          gap: "10px",
          marginTop: "clamp(6px, 1.2dvh, 10px)",
          pointerEvents: "auto",
        }}
      >
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noreferrer"
          style={{
            flex: 1,
            height: "clamp(34px, 4.8dvh, 42px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "6px",
            borderRadius: "12px",
            background: "transparent",
            border: `1.5px solid ${muted(35)}`,
            color: "currentColor",
            fontFamily: FM,
            fontSize: "clamp(11px, 1.65dvh, 13px)",
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          <SiGithub className="size-4" /> Wbij gwiazdkę
        </a>
        <button
          type="button"
          onClick={() => {
            void formbricks.track(FORMBRICKS_SURVEY_ACTION);
          }}
          style={{
            flex: 1,
            height: "clamp(34px, 4.8dvh, 42px)",
            borderRadius: "12px",
            background: "transparent",
            border: `1.5px solid ${muted(35)}`,
            color: "currentColor",
            fontFamily: FM,
            fontSize: "clamp(11px, 1.65dvh, 13px)",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Oceń nas
        </button>
      </div>
    </div>
  );
}

/** Slide id → component. Add an entry here when you add a slide to the config. */
export const SLIDE_REGISTRY: Record<SlideId, ComponentType<SlideProps>> = {
  intro: IntroSlide,
  time: TimeSlide,
  volume: VolumeSlide,
  accuracy: AccuracySlide,
  rhythm: RhythmSlide,
  top: TopSlide,
  hardest: HardestSlide,
  creator: CreatorSlide,
  rank: RankSlide,
  outro: OutroSlide,
};
