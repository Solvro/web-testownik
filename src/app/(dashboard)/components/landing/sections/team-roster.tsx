"use client";

import Image from "next/image";
import { use, useEffect, useLayoutEffect, useRef, useState } from "react";
import { FiGithub } from "react-icons/fi";

import type { GitHubContributor } from "@/lib/contributors";
import { cn } from "@/lib/utils";

import { FOCUS_RING } from "../components/focus";
import { MonoLabel } from "../components/typography";
import { TEAM_MEMBERS } from "../team-data";
import type { TeamMember } from "../team-data";

const COMMUNITY_LIMIT = 12;

const ACTIVE_MEMBERS = TEAM_MEMBERS.filter((member) => member.active);
const ALUMNI_MEMBERS = TEAM_MEMBERS.filter((member) => !member.active);

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

function memberImageUrl(
  member: TeamMember,
  github?: GitHubContributor,
): string | undefined {
  if (github?.avatar_url !== undefined) {
    return github.avatar_url;
  }
  if (member.github !== undefined) {
    return `https://github.com/${member.github}.png`;
  }
  return member.imageUrl;
}

/** Matches the 512² portrait rendered in MemberCredit (2× for ~256px cards). */
const MEMBER_PORTRAIT_SIZE = 512;

function memberUiAvatarUrl(name: string): string {
  return `https://ui-avatars.com/api/?background=7c3aed&color=fff&name=${name.replaceAll(" ", "+")}&size=${String(MEMBER_PORTRAIT_SIZE)}`;
}

function MemberPortrait({
  imageUrl,
  member,
}: {
  imageUrl?: string;
  member: TeamMember;
}): React.JSX.Element {
  const fallbackUrl = memberUiAvatarUrl(member.name);
  const [src, setSrc] = useState(imageUrl ?? fallbackUrl);

  useEffect(() => {
    setSrc(imageUrl ?? fallbackUrl);
  }, [fallbackUrl, imageUrl]);

  return (
    <Image
      src={src}
      width={MEMBER_PORTRAIT_SIZE}
      height={MEMBER_PORTRAIT_SIZE}
      alt=""
      unoptimized
      className="size-full object-cover"
      onError={() => {
        if (src !== fallbackUrl) {
          setSrc(fallbackUrl);
        }
      }}
    />
  );
}

function MemberCredit({
  github,
  member,
}: {
  github?: GitHubContributor;
  member: TeamMember;
}): React.JSX.Element {
  const hardcodedGitHubUrl =
    member.github === undefined
      ? undefined
      : `https://github.com/${member.github}`;
  const profileUrl =
    github?.html_url ??
    ("profileUrl" in member ? member.profileUrl : undefined) ??
    hardcodedGitHubUrl;
  const imageUrl = memberImageUrl(member, github);
  const content = (
    <>
      <div className="bg-background relative aspect-square overflow-hidden">
        <MemberPortrait imageUrl={imageUrl} member={member} />
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
          <MonoLabel size="2xs" tone="primary" className="truncate">
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
      <article className="w-3/5 max-w-60 shrink-0 sm:w-56 lg:w-64">
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
      className={cn(
        "group/member block w-3/5 max-w-60 shrink-0 rounded-sm transition-transform duration-150 active:scale-[0.98] sm:w-56 lg:w-64",
        FOCUS_RING,
      )}
    >
      {content}
    </a>
  );
}

interface AvatarStackItem {
  key: string;
  href?: string;
  imageUrl?: string;
  fallback: string;
  title: string;
  detail: string;
}

/**
 * Per-avatar tip via CSS hover — stays anchored to the icon, no portal remounts.
 */
function AvatarStack({
  items,
  labelPrefix,
}: {
  items: readonly AvatarStackItem[];
  labelPrefix: string;
}): React.JSX.Element {
  return (
    <div className="flex -space-x-2.5 px-2">
      {items.map((item) => {
        const avatar =
          item.imageUrl === undefined ? (
            <span className="bg-muted text-muted-foreground flex size-full items-center justify-center rounded-full text-[0.65rem] font-bold">
              {item.fallback}
            </span>
          ) : (
            <Image
              src={item.imageUrl}
              width={40}
              height={40}
              alt=""
              unoptimized
              className="size-full rounded-full object-cover"
            />
          );

        const tip = (
          <span
            aria-hidden="true"
            className={cn(
              "bg-foreground text-background pointer-events-none absolute bottom-[calc(100%+0.55rem)] left-1/2 z-20 -translate-x-1/2",
              "rounded-md px-3 py-1.5 text-xs whitespace-nowrap shadow-md",
              "invisible opacity-0 transition-opacity duration-100",
              "group-hover/avatar:visible group-hover/avatar:opacity-100",
              "group-focus-visible/avatar:visible group-focus-visible/avatar:opacity-100",
            )}
          >
            <span className="font-semibold">{item.title}</span>
            <span className="opacity-70"> · {item.detail}</span>
            <span className="bg-foreground absolute top-full left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-[2px]" />
          </span>
        );

        const className = cn(
          "group/avatar border-secondary bg-background relative block size-11 rounded-full border-2 transition-transform duration-150",
          "hover:z-10 hover:-translate-y-1 focus-visible:z-10 active:scale-[0.96]",
          FOCUS_RING,
        );

        if (item.href === undefined) {
          return (
            <span
              key={item.key}
              aria-label={`${item.title}, ${item.detail}`}
              className={className}
            >
              {avatar}
              {tip}
            </span>
          );
        }

        return (
          <a
            key={item.key}
            href={item.href}
            target="_blank"
            rel="noreferrer"
            aria-label={`${labelPrefix}${item.title}, ${item.detail}`}
            className={className}
          >
            {avatar}
            {tip}
          </a>
        );
      })}
    </div>
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

  useLayoutEffect(() => {
    const carousel = carouselRef.current;
    if (carousel === null) {
      return;
    }

    for (const node of carousel.querySelectorAll<HTMLElement>(
      "[data-carousel-clone]",
    )) {
      node.remove();
    }

    const originals = [...carousel.children].filter(
      (child): child is HTMLElement =>
        child instanceof HTMLElement &&
        child.dataset.carouselClone === undefined,
    );

    for (const [index, original] of originals.entries()) {
      const clone = original.cloneNode(true) as HTMLElement;
      clone.dataset.carouselClone = "";
      clone.setAttribute("aria-hidden", "true");
      if (index === 0) {
        clone.dataset.carouselLoopStart = "";
      }
      for (const link of clone.querySelectorAll<HTMLElement>("a[href]")) {
        link.setAttribute("aria-hidden", "true");
        link.tabIndex = -1;
      }
      carousel.append(clone);
    }
  }, [contributors]);

  useEffect(() => {
    const carousel = carouselRef.current;
    if (carousel === null) {
      return;
    }

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReducedMotion) {
      return;
    }

    const scrollSpeed = 160;
    const stopEasingDuration = 550;
    const startEasingDuration = 650;

    let loopPoint = 0;
    let isHovered = false;
    let isVisible = false;
    let currentSpeed = scrollSpeed;
    let scrollPosition = carousel.scrollLeft;
    let previousTime = 0;
    let animationFrameId = 0;

    const updateLoopPoint = () => {
      const first = carousel.firstElementChild;
      const loopStart = carousel.querySelector<HTMLElement>(
        "[data-carousel-loop-start]",
      );
      if (
        !(first instanceof HTMLElement) ||
        loopStart === null ||
        first === loopStart
      ) {
        loopPoint = 0;
        return;
      }
      loopPoint = loopStart.offsetLeft - first.offsetLeft;
    };

    const wrapScroll = (value: number): number => {
      if (loopPoint <= 0) {
        return value;
      }
      let next = value % loopPoint;
      if (next < 0) {
        next += loopPoint;
      }
      return next;
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

      scrollPosition = wrapScroll(
        scrollPosition + currentSpeed * elapsedSeconds,
      );
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
      carousel.removeEventListener("wheel", handleManualScrollStart);
      carousel.removeEventListener("scroll", handleScroll);
    };
  }, [contributors]);

  return (
    <div className="mt-10">
      <div className="border-border border-b pb-3">
        <MonoLabel size="2xs">{ACTIVE_MEMBERS.length} OSÓB</MonoLabel>
      </div>

      <div
        ref={carouselRef}
        aria-label="Zespół Testownika"
        className="mt-5 flex gap-3 overflow-x-auto overscroll-x-contain pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {ACTIVE_MEMBERS.map((member) => (
          <MemberCredit
            key={member.name}
            member={member}
            github={
              "github" in member
                ? githubByLogin.get(member.github.toLowerCase())
                : undefined
            }
          />
        ))}
      </div>
    </div>
  );
}

function AlumniContributors({
  contributors,
}: {
  contributors: readonly GitHubContributor[];
}): React.JSX.Element | null {
  if (ALUMNI_MEMBERS.length === 0) {
    return null;
  }

  const githubByLogin = new Map(
    contributors.map((contributor) => [
      contributor.login.toLowerCase(),
      contributor,
    ]),
  );

  const items: AvatarStackItem[] = ALUMNI_MEMBERS.map((member) => {
    const github =
      "github" in member
        ? githubByLogin.get(member.github.toLowerCase())
        : undefined;
    let href: string | undefined = github?.html_url;
    if (href === undefined && "github" in member) {
      href = `https://github.com/${member.github}`;
    }

    return {
      key: member.name,
      href,
      imageUrl: memberImageUrl(member, github),
      fallback: initials(member.name),
      title: member.name,
      detail: `${member.team} · ${member.role}`,
    };
  });

  return (
    <section
      aria-labelledby="alumni-contributors"
      className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
    >
      <header>
        <MonoLabel size="2xs">EX ZESPÓŁ</MonoLabel>
        <h3
          id="alumni-contributors"
          className="mt-1 text-sm font-bold tracking-[-0.02em]"
        >
          {ALUMNI_MEMBERS.length}{" "}
          {ALUMNI_MEMBERS.length === 1
            ? "osoba, która współtworzyła projekt"
            : "osób, które współtworzyły projekt"}
        </h3>
      </header>

      <AvatarStack items={items} labelPrefix="" />
    </section>
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

  const items: AvatarStackItem[] = community.map((person) => ({
    key: person.login,
    href: person.html_url,
    imageUrl: person.avatar_url,
    fallback: person.login.slice(0, 2).toUpperCase(),
    title: `@${person.login}`,
    detail: formatCommitCount(person.contributions),
  }));

  return (
    <section
      aria-labelledby="community-contributors"
      className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
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

      <AvatarStack items={items} labelPrefix="" />
    </section>
  );
}

export function TeamRosterFallback(): React.JSX.Element {
  return (
    <>
      <TeamDirectory />
      <AlumniContributors contributors={[]} />
    </>
  );
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
      <AlumniContributors contributors={resolved} />
      <CommunityContributors contributors={resolved} />
    </>
  );
}
