import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { cn } from "@/lib/utils";

import { FAQ } from "../landing-content";
import { FOCUS_RING } from "../ui/focus";
import { HandNote } from "../ui/hand-note";
import { DisplayHeading } from "../ui/typography";

export function Faq(): React.JSX.Element {
  return (
    <section
      id="faq"
      tabIndex={-1}
      className="text-foreground relative scroll-mt-[5rem] py-16 outline-none sm:py-24 lg:py-36"
    >
      <div className="relative mx-auto grid w-[calc(100%-2rem)] grid-cols-1 gap-8 sm:w-[min(100%-3rem,96rem)] sm:gap-12 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)] lg:gap-[7vw] 2xl:grid-cols-[minmax(max-content,0.72fr)_minmax(0,1.28fr)]">
        <header className="self-start lg:sticky lg:top-24">
          <HandNote className="mb-5">02 / zanim zapytasz</HandNote>
          <DisplayHeading>
            Pytania?
            <br />
            <em>Odpowiedzi.</em>
          </DisplayHeading>
          <p className="text-muted-foreground mt-6 max-w-[30rem] leading-[1.65]">
            Jak zacząć naukę, tworzyć quizy i&nbsp;korzystać z&nbsp;pozostałych
            funkcji? Odpowiadamy na&nbsp;najczęstsze pytania o&nbsp;Testownik.
          </p>
        </header>

        <Accordion
          aria-label="Pytania i odpowiedzi"
          defaultValue={["faq-0"]}
          className="border-border border-t"
        >
          {FAQ.map((item, index) => (
            <AccordionItem key={item.question} value={`faq-${String(index)}`}>
              <AccordionTrigger
                className={cn(
                  "hover:text-primary aria-expanded:text-primary -mx-3 gap-4 rounded-lg px-3 py-5 text-[clamp(1rem,1.5vw,1.3rem)] leading-[1.25] font-semibold tracking-[-0.025em] hover:no-underline sm:gap-6 sm:py-6 [&_svg]:mt-1 [&_svg]:text-current!",
                  // The landing's outline instead of the app's ring and
                  // border, inset so it clears the separators. Its focus
                  // ::after would join the flex row and shift the chevron.
                  "after:hidden focus-visible:border-transparent focus-visible:ring-0",
                  FOCUS_RING,
                  "focus-visible:-outline-offset-2 focus-visible:outline-solid",
                )}
              >
                {item.question}
              </AccordionTrigger>
              <AccordionContent
                aria-label={item.question}
                className="text-muted-foreground max-w-[44rem] pr-0 pb-5 text-[0.95rem] leading-[1.7] sm:pr-10 sm:pb-6 sm:text-[0.98rem]"
              >
                {item.answer.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
