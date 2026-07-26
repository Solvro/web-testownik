"use client";

import Image from "next/image";
import { use, useEffect, useRef } from "react";
import { FiGithub } from "react-icons/fi";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { GitHubContributor } from "@/lib/contributors";
import { cn } from "@/lib/utils";

import { FOCUS_RING } from "../components/focus";
import { MonoLabel } from "../components/typography";
import { TEAM_MEMBERS } from "../team-data";
import type { TeamMember } from "../team-data";

const COMMUNITY_LIMIT = 12;

const TEAM_GITHUB_HANDLES = new Set(
  TEAM_MEMBERS.flatMap((member) =>
    "github" in member ? [member.github.toLowerCase()] : [],
  ),
);

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2);
}

function formatCommitCount(count: number): string {
  if (count === 1) {
    return "1 commit";
  }

  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  const noun =
    lastDigit >= 2 &&
    lastDigit <= 4 &&
    (lastTwoDigits < 12 || lastTwoDigits > 14)
      ? "commity"
      : "commitów";

  return `${count.toString()} ${noun}`;
}

function MemberPortrait({
  imageUrl,
  member,
}: {
  imageUrl?: string;
  member: TeamMember;
}): React.JSX.Element {
  if (imageUrl !== undefined) {
    return (
      <Image
        src={imageUrl}
        width={512}
        height={512}
        alt=""
        unoptimized
        className="size-full object-cover"
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className="bg-background text-muted-foreground/35 font-landing flex size-full items-end p-4 text-6xl font-[720] tracking-[-0.1em]"
    >
      {initials(member.name)}
    </span>
  );
}

function MemberCredit({
  duplicate = false,
  github,
  loopStart = false,
  member,
}: {
  duplicate?: boolean;
  github?: GitHubContributor;
  loopStart?: boolean;
  member: TeamMember;
}): React.JSX.Element {
  const hardcodedGitHubUrl =
    member.github === undefined
      ? undefined
      : `https://github.com/${member.github}`;
  const profileUrl =
    github?.html_url ?? member.profileUrl ?? hardcodedGitHubUrl;
  const imageUrl =
    github?.avatar_url ??
    (member.github === undefined
      ? member.imageUrl
      : `https://github.com/${member.github}.png`);
  const content = (
    <>
      <div className="bg-background relative aspect-square overflow-hidden">
        <MemberPortrait imageUrl={imageUrl} member={member} />
        {member.active ? null : (
          <span className="bg-background/90 text-foreground absolute top-3 left-3 rounded-full px-2 py-1 text-[0.6rem] font-bold tracking-[0.08em] uppercase backdrop-blur-sm">
            EX
          </span>
        )}
      </div>

      <div className="mt-3 min-w-0">
        <strong className="block truncate text-sm tracking-[-0.02em]">
          {member.name}
        </strong>
        <div className="mt-1 flex min-w-0 items-center gap-1.5">
          <MonoLabel size="2xs" tone="muted" className="truncate">
            {member.team}
          </MonoLabel>
          <span
            aria-hidden="true"
            className="bg-border size-0.5 shrink-0 rounded-full"
          />
          <MonoLabel
            size="2xs"
            tone={member.active ? "primary" : "muted"}
            className="truncate"
          >
            {member.role}
          </MonoLabel>
        </div>
        {github === undefined ? null : (
          <span className="text-muted-foreground mt-2 flex items-center gap-1.5 text-[0.68rem]">
            <FiGithub aria-hidden="true" className="size-3" />
            {formatCommitCount(github.contributions)}
          </span>
        )}
      </div>
    </>
  );

  if (profileUrl === undefined) {
    return (
      <article
        aria-hidden={duplicate || undefined}
        data-carousel-loop-start={loopStart || undefined}
        className="w-3/5 max-w-60 shrink-0 sm:w-56 lg:w-64"
      >
        {content}
      </article>
    );
  }

  return (
    <a
      href={profileUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={`${member.name} — otwórz profil`}
      aria-hidden={duplicate || undefined}
      data-carousel-loop-start={loopStart || undefined}
      tabIndex={duplicate ? -1 : undefined}
      className={cn(
        "group/member block w-3/5 max-w-60 shrink-0 rounded-sm transition-transform duration-150 active:scale-[0.98] sm:w-56 lg:w-64",
        FOCUS_RING,
      )}
    >
      {content}
    </a>
  );
}

function TeamDirectory({
  contributors = [],
}: {
  contributors?: readonly GitHubContributor[];
}): React.JSX.Element {
  const carouselRef = useRef<HTMLDivElement>(null);
  const githubByLogin = new Map(
    contributors.map((contributor) => [
      contributor.login.toLowerCase(),
      contributor,
    ]),
  );
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const scrollSpeed = 160;
    const stopEasingDuration = 550;
    const startEasingDuration = 650;
    const carousel = carouselRef.current;
    if (carousel === null) {
      return;
    }

    const loopStart = carousel.querySelector<HTMLElement>(
      "[data-carousel-loop-start]",
    );
    let loopPoint = 0;
    let isHovered = false;
    let isVisible = false;
    let currentSpeed = scrollSpeed;
    let scrollPosition = carousel.scrollLeft;
    let previousTime = 0;
    let animationFrameId = 0;

    const updateLoopPoint = () => {
      loopPoint =
        loopStart === null ? 0 : loopStart.offsetLeft - carousel.offsetLeft;
    };
    const handlePointerEnter = () => {
      scrollPosition = carousel.scrollLeft;
      isHovered = true;
    };
    const handlePointerLeave = () => {
      scrollPosition = carousel.scrollLeft;
      isHovered = false;
    };
    const handleManualScrollStart = () => {
      currentSpeed = 0;
      scrollPosition = carousel.scrollLeft;
    };
    const handleScroll = () => {
      if (isHovered && currentSpeed === 0) {
        scrollPosition = carousel.scrollLeft;
      }
    };

    const animate = (time: number) => {
      if (!isVisible) {
        animationFrameId = 0;
        return;
      }

      const elapsed = Math.min(time - previousTime, 64);
      previousTime = time;
      const elapsedSeconds = elapsed / 1000;
      const targetSpeed = isHovered ? 0 : scrollSpeed;
      const easingDuration = isHovered
        ? stopEasingDuration
        : startEasingDuration;
      const easing = 1 - Math.exp(-elapsed / easingDuration);

      currentSpeed += (targetSpeed - currentSpeed) * easing;
      if (isHovered && currentSpeed < 1) {
        currentSpeed = 0;
      }

      scrollPosition += currentSpeed * elapsedSeconds;
      if (loopPoint > 0 && scrollPosition >= loopPoint) {
        scrollPosition -= loopPoint;
      }
      if (currentSpeed > 0) {
        carousel.scrollLeft = scrollPosition;
      }

      animationFrameId = window.requestAnimationFrame(animate);
    };

    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;

        if (!isVisible) {
          window.cancelAnimationFrame(animationFrameId);
          animationFrameId = 0;
          return;
        }

        if (animationFrameId === 0) {
          previousTime = performance.now();
          animationFrameId = window.requestAnimationFrame(animate);
        }
      },
      { threshold: 0.1 },
    );

    updateLoopPoint();
    const resizeObserver = new ResizeObserver(updateLoopPoint);
    resizeObserver.observe(carousel);
    intersectionObserver.observe(carousel);
    carousel.addEventListener("pointerenter", handlePointerEnter);
    carousel.addEventListener("pointerleave", handlePointerLeave);
    carousel.addEventListener("pointerdown", handleManualScrollStart);
    carousel.addEventListener("wheel", handleManualScrollStart, {
      passive: true,
    });
    carousel.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      intersectionObserver.disconnect();
      resizeObserver.disconnect();
      carousel.removeEventListener("pointerenter", handlePointerEnter);
      carousel.removeEventListener("pointerleave", handlePointerLeave);
      carousel.removeEventListener("pointerdown", handleManualScrollStart);
      carousel.removeEventListener("wheel", handleManualScrollStart);
      carousel.removeEventListener("scroll", handleScroll);
    };
  }, []);

  return (
    <div className="mt-10">
      <div className="border-border border-b pb-3">
        <MonoLabel size="2xs">{TEAM_MEMBERS.length} OSÓB</MonoLabel>
      </div>

      <div
        ref={carouselRef}
        aria-label="Zespół Testownika"
        className="mt-5 flex gap-3 overflow-x-auto overscroll-x-contain pb-3 [will-change:scroll-position] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {[false, true].flatMap((duplicate) =>
          TEAM_MEMBERS.map((member, memberIndex) => (
            <MemberCredit
              key={`${duplicate ? "copy" : "original"}-${member.name}`}
              duplicate={duplicate}
              loopStart={duplicate ? memberIndex === 0 : false}
              member={member}
              github={
                "github" in member
                  ? githubByLogin.get(member.github.toLowerCase())
                  : undefined
              }
            />
          )),
        )}
      </div>
    </div>
  );
}

function CommunityContributors({
  contributors,
}: {
  contributors: readonly GitHubContributor[];
}): React.JSX.Element | null {
  const community = contributors
    .filter(
      (contributor) =>
        !TEAM_GITHUB_HANDLES.has(contributor.login.toLowerCase()),
    )
    .slice(0, COMMUNITY_LIMIT);

  if (community.length === 0) {
    return null;
  }

  return (
    <section
      aria-labelledby="community-contributors"
      className="border-border mt-7 flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <header>
        <MonoLabel size="2xs">OPEN SOURCE</MonoLabel>
        <h3
          id="community-contributors"
          className="mt-1 text-sm font-bold tracking-[-0.02em]"
        >
          {community.length} kontrybutorów spoza zespołu
        </h3>
      </header>

      <div className="flex -space-x-2.5 px-2 pt-5">
        {community.map((person) => (
          <Tooltip key={person.login}>
            <TooltipTrigger
              render={
                <a
                  href={person.html_url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`${person.login}, ${formatCommitCount(person.contributions)} na GitHubie`}
                  className={cn(
                    "border-secondary bg-background relative block size-11 rounded-full border-2 transition-transform duration-150 hover:z-10 hover:-translate-y-1 active:scale-[0.96]",
                    FOCUS_RING,
                  )}
                >
                  <Image
                    src={person.avatar_url}
                    width={40}
                    height={40}
                    alt=""
                    unoptimized
                    className="size-full rounded-full object-cover"
                  />
                </a>
              }
            ></TooltipTrigger>
            <TooltipContent side="top">
              @{person.login} · {formatCommitCount(person.contributions)}
            </TooltipContent>
          </Tooltip>
        ))}
      </div>
    </section>
  );
}

export function TeamRosterFallback(): React.JSX.Element {
  return <TeamDirectory />;
}

export function TeamRoster({
  contributors,
}: {
  contributors: Promise<GitHubContributor[]>;
}): React.JSX.Element {
  const resolved = use(contributors);

  return (
    <>
      <TeamDirectory contributors={resolved} />
      <CommunityContributors contributors={resolved} />
    </>
  );
}
