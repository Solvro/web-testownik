import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

import { FAQ } from "../landing-content";
import { DisplayHeading } from "../ui/typography";

export function Faq(): React.JSX.Element {
  return (
    <section
      id="faq"
      className="dark bg-background text-foreground relative scroll-mt-4 overflow-hidden py-16 sm:py-24 lg:py-36"
    >
      <div className="relative mx-auto grid w-[calc(100%-2rem)] grid-cols-1 gap-8 sm:w-[min(100%-3rem,96rem)] sm:gap-12 lg:grid-cols-[minmax(18rem,0.72fr)_minmax(0,1.28fr)] lg:gap-[7vw] 2xl:grid-cols-[minmax(max-content,0.72fr)_minmax(0,1.28fr)]">
        <header className="self-start lg:sticky lg:top-0">
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
              <AccordionTrigger className="hover:text-primary aria-expanded:text-primary gap-4 rounded-none py-5 text-[clamp(1rem,1.5vw,1.3rem)] leading-[1.25] font-semibold tracking-[-0.025em] hover:no-underline sm:gap-6 sm:py-6 [&_svg]:mt-1 [&_svg]:text-current!">
                {item.question}
              </AccordionTrigger>
              <AccordionContent
                aria-label={item.question}
                className="text-muted-foreground max-w-[44rem] pr-0 pb-5 text-[0.95rem] leading-[1.7] sm:pr-10 sm:pb-6 sm:text-[0.98rem]"
              >
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
