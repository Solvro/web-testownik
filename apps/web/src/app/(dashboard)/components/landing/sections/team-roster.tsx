"use client";

import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import { use, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import type { GitHubContributor } from "@/lib/contributors";
import { cn } from "@/lib/utils";

import { FOCUS_RING } from "../components/focus";
import { MonoLabel } from "../components/typography";
import { REPOSITORY_URL } from "../landing-content";
import { TEAM_MEMBERS } from "../team-data";
import type { ProjectTeam, TeamMember } from "../team-data";

const COMMUNITY_LIMIT = 12;
const SKELETON_COUNT = 6;
/*
 * The open source grid always spans COMMUNITY_LIMIT slots, filled or not, so the
 * skeleton and the resolved list take the same rows at every column count.
 */

/** Masthead order: who decides, who builds, who makes it look and sound good. */
const TEAM_ORDER: readonly ProjectTeam[] = [
  "Product",
  "Frontend",
  "Backend",
  "AI/ML",
  "UX/UI",
  "Promo",
];

/** Roles credited with a pill rather than plain text. */
const LEAD_ROLES = new Set(["Tech Lead", "Product Owner", "Project Manager"]);

const ACTIVE_MEMBERS: readonly TeamMember[] = TEAM_MEMBERS.filter(
  (member) => member.active,
);
const ALUMNI_MEMBERS: readonly TeamMember[] = TEAM_MEMBERS.filter(
  (member) => !member.active,
);

const TEAM_GROUPS = TEAM_ORDER.map((team) => ({
  team,
  members: ACTIVE_MEMBERS.filter((member) => member.team === team),
})).filter((group) => group.members.length > 0);

const TEAM_GITHUB_HANDLES = new Set(
  TEAM_MEMBERS.flatMap((member) =>
    "github" in member ? [member.github.toLowerCase()] : [],
  ),
);

type GitHubByLogin = ReadonlyMap<string, GitHubContributor>;

function pluralize(
  count: number,
  one: string,
  few: string,
  many: string,
): string {
  if (count === 1) {
    return one;
  }
  const lastDigit = count % 10;
  const lastTwoDigits = count % 100;
  return lastDigit >= 2 &&
    lastDigit <= 4 &&
    (lastTwoDigits < 12 || lastTwoDigits > 14)
    ? few
    : many;
}

function formatCommitCount(count: number): string {
  return `${count.toString()} ${pluralize(count, "commit", "commity", "commitów")}`;
}

type AvatarSize = 36 | 44;

/** Twice the rendered size, for dense displays. */
function avatarPixels(size: AvatarSize): string {
  return String(size * 2);
}

/**
 * The hardcoded handle wins over the API's `avatar_url` so the fallback and
 * the resolved roster request the same image and nothing reloads on resolve.
 */
function memberImageUrl(
  member: TeamMember,
  size: AvatarSize,
): string | undefined {
  if (member.github !== undefined) {
    return `https://github.com/${member.github}.png?size=${avatarPixels(size)}`;
  }
  return member.imageUrl;
}

function memberUiAvatarUrl(name: string, size: AvatarSize): string {
  return `https://ui-avatars.com/api/?background=7c3aed&color=fff&name=${name.replaceAll(" ", "+")}&size=${avatarPixels(size)}`;
}

function contributorAvatarUrl(
  contributor: GitHubContributor,
  size: AvatarSize,
): string {
  const url = new URL(contributor.avatar_url);
  url.searchParams.set("s", avatarPixels(size));
  return url.toString();
}

function memberProfileUrl(
  member: TeamMember,
  github?: GitHubContributor,
): string | undefined {
  if (github !== undefined) {
    return github.html_url;
  }
  if (member.profileUrl !== undefined) {
    return member.profileUrl;
  }
  return member.github === undefined
    ? undefined
    : `https://github.com/${member.github}`;
}

function githubFor(
  member: TeamMember,
  githubByLogin?: GitHubByLogin,
): GitHubContributor | undefined {
  return member.github === undefined
    ? undefined
    : githubByLogin?.get(member.github.toLowerCase());
}

function Avatar({
  imageUrl,
  fallbackUrl,
  size,
}: {
  imageUrl?: string;
  fallbackUrl: string;
  size: AvatarSize;
}): React.JSX.Element {
  const [failedUrl, setFailedUrl] = useState<string>();
  const source =
    imageUrl === undefined || imageUrl === failedUrl ? fallbackUrl : imageUrl;

  return (
    <Image
      src={source}
      width={size}
      height={size}
      sizes={`${String(size)}px`}
      alt=""
      unoptimized
      className={cn(
        "bg-muted ring-border shrink-0 rounded-full object-cover ring-1",
        size === 44 ? "size-11" : "size-9",
      )}
      onError={() => {
        if (source !== fallbackUrl) {
          setFailedUrl(source);
        }
      }}
    />
  );
}

/** A link when there is somewhere to go, a plain block otherwise. */
function EntryShell({
  href,
  label,
  children,
}: {
  href?: string;
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  const className =
    "group/entry -m-1.5 flex min-w-0 items-center gap-3 rounded-md p-1.5";

  if (href === undefined) {
    return <div className={className}>{children}</div>;
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      aria-label={label}
      className={cn(className, FOCUS_RING)}
    >
      {children}
    </a>
  );
}

function EntryName({
  children,
  linked,
  className,
}: {
  children: React.ReactNode;
  linked: boolean;
  className?: string;
}): React.JSX.Element {
  return (
    <span className="flex min-w-0 items-center gap-1">
      <span
        className={cn(
          "min-w-0 font-semibold tracking-[-0.015em] break-words transition-colors duration-150",
          linked && "group-hover/entry:text-primary",
          className,
        )}
      >
        {children}
      </span>
      {linked ? (
        <ArrowUpRight
          aria-hidden="true"
          className="text-primary size-3.5 shrink-0 opacity-0 transition-opacity duration-150 group-hover/entry:opacity-100 group-focus-visible/entry:opacity-100"
        />
      ) : null}
    </span>
  );
}

/** Always rendered so the roster keeps its height when commit counts arrive. */
function CommitMeta({ count }: { count?: number }): React.JSX.Element {
  return (
    <span className="font-landing-mono text-muted-foreground block h-4 text-[0.62rem] leading-4 tracking-[0.04em]">
      {count === undefined ? null : formatCommitCount(count)}
    </span>
  );
}

function MemberEntry({
  member,
  githubByLogin,
  compact = false,
}: {
  member: TeamMember;
  githubByLogin?: GitHubByLogin;
  compact?: boolean;
}): React.JSX.Element {
  const github = githubFor(member, githubByLogin);
  const href = memberProfileUrl(member, github);
  const size = compact ? 36 : 44;
  const isLead = !compact && LEAD_ROLES.has(member.role);
  const role = compact ? `${member.team} · ${member.role}` : member.role;

  return (
    <EntryShell href={href} label={`${member.name}, ${role} — otwórz profil`}>
      <Avatar
        imageUrl={memberImageUrl(member, size)}
        fallbackUrl={memberUiAvatarUrl(member.name, size)}
        size={size}
      />
      <span className="flex min-w-0 flex-col">
        <EntryName
          linked={href !== undefined}
          className={
            compact ? "text-sm leading-5" : "text-[0.9375rem] leading-5"
          }
        >
          {member.name}
        </EntryName>
        {isLead ? (
          <span className="mt-0.5 flex h-[1.125rem] items-center">
            <MonoLabel
              size="2xs"
              tone="primary"
              className="bg-primary/10 ring-primary/25 rounded-full px-1.5 py-[0.2rem] leading-none ring-1 ring-inset"
            >
              {member.role}
            </MonoLabel>
          </span>
        ) : (
          <span
            className={cn(
              "text-muted-foreground mt-0.5 leading-[1.125rem]",
              compact ? "text-xs" : "text-[0.8125rem]",
            )}
          >
            {role}
          </span>
        )}
        <CommitMeta count={github?.contributions} />
      </span>
    </EntryShell>
  );
}

function ContributorEntry({
  contributor,
}: {
  contributor: GitHubContributor;
}): React.JSX.Element {
  const commits = formatCommitCount(contributor.contributions);

  return (
    <EntryShell
      href={contributor.html_url}
      label={`@${contributor.login}, ${commits} — otwórz profil`}
    >
      <Avatar
        imageUrl={contributorAvatarUrl(contributor, 36)}
        fallbackUrl={memberUiAvatarUrl(contributor.login, 36)}
        size={36}
      />
      <span className="flex min-w-0 flex-col">
        <EntryName
          linked
          className="text-sm leading-5 [overflow-wrap:anywhere]"
        >
          {contributor.login}
        </EntryName>
        <CommitMeta count={contributor.contributions} />
      </span>
    </EntryShell>
  );
}

/** One masthead line: the label column on the left, credits on the right. */
function CreditRow({
  label,
  labelledBy,
  aside,
  children,
}: {
  label: string;
  labelledBy: string;
  aside?: React.ReactNode;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section
      aria-labelledby={labelledBy}
      className="lg:border-border grid grid-cols-1 gap-x-8 gap-y-4 py-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)] lg:border-t lg:py-7"
    >
      <div className="flex min-h-4 items-center gap-3 lg:block">
        <h3 id={labelledBy} className="shrink-0 leading-none">
          <MonoLabel size="md" tone="default">
            {label}
          </MonoLabel>
        </h3>
        <span
          aria-hidden="true"
          className="bg-border h-px min-w-0 flex-1 lg:hidden"
        />
        {aside}
      </div>
      {children}
    </section>
  );
}

function labelId(label: string): string {
  return `team-${label.toLowerCase().replaceAll(/[^a-z]+/g, "-")}`;
}

/** Sits beside the label on phones, under it on desktop; reserved while loading. */
function OpenSourceMore({
  hidden,
  pending,
}: {
  hidden: number;
  pending: boolean;
}): React.JSX.Element | null {
  if (pending) {
    return <span aria-hidden="true" className="block h-4 shrink-0 lg:mt-3" />;
  }

  if (hidden <= 0) {
    return null;
  }

  return (
    <a
      href={`${REPOSITORY_URL}/graphs/contributors`}
      target="_blank"
      rel="noreferrer"
      className={cn(
        "text-muted-foreground hover:text-primary inline-flex h-4 shrink-0 items-center gap-1 rounded-sm text-xs font-semibold transition-colors duration-150 lg:mt-3 [&_svg]:size-3.5",
        FOCUS_RING,
      )}
    >
      +{hidden} więcej na GitHubie
      <ArrowUpRight aria-hidden="true" />
    </a>
  );
}

function Masthead({
  githubByLogin,
  community,
}: {
  githubByLogin?: GitHubByLogin;
  /** `undefined` while GitHub is still loading. */
  community?: readonly GitHubContributor[];
}): React.JSX.Element {
  const visibleCommunity = community?.slice(0, COMMUNITY_LIMIT);
  const hiddenCommunity =
    community === undefined ? 0 : community.length - COMMUNITY_LIMIT;

  return (
    <div className="mt-10 sm:mt-14">
      <MonoLabel size="xs" className="block">
        {ACTIVE_MEMBERS.length}{" "}
        {pluralize(ACTIVE_MEMBERS.length, "osoba", "osoby", "osób")} ·{" "}
        {TEAM_GROUPS.length}{" "}
        {pluralize(TEAM_GROUPS.length, "zespół", "zespoły", "zespołów")}
      </MonoLabel>

      <div className="mt-3 lg:mt-4">
        {TEAM_GROUPS.map(({ team, members }) => (
          <CreditRow key={team} label={team} labelledBy={labelId(team)}>
            <ul className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
              {members.map((member) => (
                <li key={member.name} className="min-w-0">
                  <MemberEntry member={member} githubByLogin={githubByLogin} />
                </li>
              ))}
            </ul>
          </CreditRow>
        ))}
      </div>

      <div className="lg:border-border mt-2 lg:mt-8 lg:border-t">
        {ALUMNI_MEMBERS.length === 0 ? null : (
          <CreditRow label="Ex zespół" labelledBy="team-alumni">
            <ul className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3 xl:grid-cols-4">
              {ALUMNI_MEMBERS.map((member) => (
                <li key={member.name} className="min-w-0">
                  <MemberEntry
                    compact
                    member={member}
                    githubByLogin={githubByLogin}
                  />
                </li>
              ))}
            </ul>
          </CreditRow>
        )}

        {visibleCommunity?.length === 0 ? null : (
          <CreditRow
            label="Open source"
            labelledBy="team-community"
            aside={
              <OpenSourceMore
                hidden={hiddenCommunity}
                pending={community === undefined}
              />
            }
          >
            <ul
              aria-busy={community === undefined}
              className="grid grid-cols-2 gap-x-6 gap-y-4 md:grid-cols-3 xl:grid-cols-4"
            >
              {visibleCommunity === undefined
                ? Array.from({ length: SKELETON_COUNT }, (_, index) => (
                    <li
                      key={index}
                      aria-hidden="true"
                      className="flex h-9 items-center gap-3"
                    >
                      <Skeleton className="size-9 shrink-0 rounded-full" />
                      <span className="flex flex-col gap-2">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-2 w-12" />
                      </span>
                    </li>
                  ))
                : visibleCommunity.map((contributor) => (
                    <li key={contributor.login} className="min-w-0">
                      <ContributorEntry contributor={contributor} />
                    </li>
                  ))}
              {Array.from(
                {
                  length:
                    COMMUNITY_LIMIT -
                    (visibleCommunity?.length ?? SKELETON_COUNT),
                },
                (_, index) => (
                  <li
                    key={`slot-${String(index)}`}
                    aria-hidden="true"
                    className="h-9"
                  />
                ),
              )}
            </ul>
          </CreditRow>
        )}
      </div>
    </div>
  );
}

export function TeamRosterFallback(): React.JSX.Element {
  return <Masthead />;
}

export function TeamRoster({
  contributors,
}: {
  contributors: Promise<GitHubContributor[]>;
}): React.JSX.Element {
  const resolved = use(contributors);
  const githubByLogin = new Map(
    resolved.map((contributor) => [
      contributor.login.toLowerCase(),
      contributor,
    ]),
  );
  const community = resolved
    .filter(
      (contributor) =>
        !TEAM_GITHUB_HANDLES.has(contributor.login.toLowerCase()),
    )
    .toSorted((a, b) => b.contributions - a.contributions);

  return <Masthead githubByLogin={githubByLogin} community={community} />;
}
