import { ArrowUpRight } from "lucide-react";
import { Suspense } from "react";
import { FiGithub } from "react-icons/fi";

import type { GitHubContributor } from "@/lib/contributors";
import { cn } from "@/lib/utils";

import { FOCUS_RING } from "../components/focus";
import { DisplayHeading } from "../components/typography";
import { REPOSITORY_URL } from "../landing-content";
import { TeamRoster, TeamRosterFallback } from "./team-roster";

export function Team({
  contributors,
}: {
  /**
   * Unresolved on purpose. The complete hardcoded roster renders immediately;
   * GitHub enriches it and adds outside contributors when the request resolves.
   */
  contributors: Promise<GitHubContributor[]>;
}): React.JSX.Element {
  return (
    <section
      id="team"
      className="bg-background w-full scroll-mt-4 px-4 py-16 sm:px-[max(1.5rem,calc((100vw-96rem)/2))]"
    >
      <header className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)] lg:items-end">
        <div>
          <DisplayHeading className="max-w-[12ch] text-[clamp(2.8rem,11vw,4.2rem)] leading-[0.9] sm:text-[clamp(3.4rem,5vw,4.9rem)]">
            Ten zespół
            <br />
            <em>tworzy projekt</em>
          </DisplayHeading>
        </div>

        <div className="border-border border-t pt-4 lg:border-t-0 lg:pt-0">
          <p className="text-muted-foreground max-w-[32rem] text-sm leading-relaxed">
            Czyli jak coś nie działa to na nich można zwalić
          </p>
          <a
            href={REPOSITORY_URL}
            target="_blank"
            rel="noreferrer"
            className={cn(
              "text-foreground hover:text-primary mt-4 inline-flex items-center gap-2 rounded-sm text-xs font-bold transition-[color,transform] duration-150 active:scale-[0.98] [&_svg]:size-3.5",
              FOCUS_RING,
            )}
          >
            <FiGithub aria-hidden="true" />
            Zobacz projekt
            <ArrowUpRight aria-hidden="true" />
          </a>
        </div>
      </header>

      <Suspense fallback={<TeamRosterFallback />}>
        <TeamRoster contributors={contributors} />
      </Suspense>
    </section>
  );
}
