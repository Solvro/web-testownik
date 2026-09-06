"use client";

import { getChatToolName } from "@/components/ai/chat-tool-part";
import type { ChatToolPart } from "@/components/ai/chat-tool-part";
import { ToolActivity } from "@/components/ai/tool-activity";
import type { ToolActivityStatus } from "@/components/ai/tool-activity";
import { DisableAiTool } from "@/components/ai/tool-ui-disable-ai";
import { EditQuestionTool } from "@/components/ai/tool-ui-edit-question";
import { GeneratedQuestionsTool } from "@/components/ai/tool-ui-question";

type UnknownRecord = Record<string, unknown>;

function asRecord(value: unknown): UnknownRecord | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined;
}

function parseOutput(value: unknown): unknown {
  if (typeof value !== "string") {
    return value;
  }
  try {
    return JSON.parse(value) as unknown;
  } catch {
    return value;
  }
}

function activityStatus(state: string): ToolActivityStatus {
  if (state === "output-error" || state === "output-denied") {
    return "error";
  }
  if (state === "output-available") {
    return "complete";
  }
  if (state === "input-streaming" || state === "input-available") {
    return "running";
  }
  return "pending";
}

function humanizeToolName(toolName: string) {
  const words = toolName.replaceAll("_", " ").replaceAll("-", " ");
  return words.charAt(0).toUpperCase() + words.slice(1);
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "—";
  }
  if (typeof value === "boolean") {
    return value ? "Tak" : "Nie";
  }
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value, null, 2);
}

function ToolDetails({ part }: { part: ChatToolPart }) {
  const details = {
    input: part.input ?? null,
    ...(part.output === undefined ? {} : { output: parseOutput(part.output) }),
    ...(part.errorText === undefined ? {} : { error: part.errorText }),
  };

  return (
    <pre className="text-muted-foreground max-h-48 overflow-auto py-1 font-mono text-[11px] leading-relaxed break-words whitespace-pre-wrap">
      {JSON.stringify(details, null, 2)}
    </pre>
  );
}

function countLabel(count: number, one: string, few: string, many: string) {
  if (count === 1) {
    return `${count.toString()} ${one}`;
  }
  const lastTwo = count % 100;
  const last = count % 10;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) {
    return `${count.toString()} ${few}`;
  }
  return `${count.toString()} ${many}`;
}

function ListQuestionsTool({ part }: { part: ChatToolPart }) {
  const input = asRecord(part.input);
  const output = asRecord(parseOutput(part.output));
  const status = activityStatus(part.state);
  const query = typeof input?.query === "string" ? input.query.trim() : "";
  const matched = typeof output?.matched === "number" ? output.matched : null;
  const returned =
    typeof output?.returned === "number" ? output.returned : matched;
  let summary = query === "" ? "Przeglądam cały quiz" : `Szukam „${query}”`;
  if (status === "complete" && matched !== null) {
    summary =
      matched === 0
        ? query === ""
          ? "Quiz nie zawiera pytań"
          : `Brak wyników dla „${query}”`
        : countLabel(
            returned ?? matched,
            "znalezione pytanie",
            "znalezione pytania",
            "znalezionych pytań",
          );
  } else if (status === "error") {
    summary = part.errorText ?? "Nie udało się pobrać pytań";
  }

  return (
    <ToolActivity title={summary} status={status}>
      <ToolDetails part={part} />
    </ToolActivity>
  );
}

function GetQuestionTool({ part }: { part: ChatToolPart }) {
  const input = asRecord(part.input);
  const output = asRecord(parseOutput(part.output));
  const status = activityStatus(part.state);
  const requestedOrder = input?.question_order;
  const questionOrder = output?.order ?? requestedOrder;
  const outputError =
    typeof output?.error === "string" ? output.error : undefined;

  let summary = `Pobieram pytanie ${displayValue(requestedOrder)}`;
  if (status === "complete") {
    summary = `Pobrano pytanie ${displayValue(questionOrder)}`;
  }
  if (outputError !== undefined) {
    summary = outputError;
  }
  if (status === "error") {
    summary = part.errorText ?? "Nie udało się pobrać pytania";
  }

  return (
    <ToolActivity
      title={summary}
      status={outputError === undefined ? status : "error"}
    >
      <ToolDetails part={part} />
    </ToolActivity>
  );
}

function GenericTool({
  part,
  toolName,
}: {
  part: ChatToolPart;
  toolName: string;
}) {
  const status = activityStatus(part.state);
  const summary =
    status === "running"
      ? "Narzędzie pracuje…"
      : status === "complete"
        ? "Zakończono"
        : status === "error"
          ? (part.errorText ?? "Nie udało się wykonać narzędzia")
          : "Oczekuje na uruchomienie";

  return (
    <ToolActivity
      title={`${humanizeToolName(toolName)} · ${summary}`}
      status={status}
    >
      <ToolDetails part={part} />
    </ToolActivity>
  );
}

function activeToolTitle(part: ChatToolPart) {
  const toolName = getChatToolName(part);
  const input = asRecord(part.input);

  if (toolName === "list_questions") {
    const query = typeof input?.query === "string" ? input.query.trim() : "";
    return query === "" ? "Przeglądam pytania" : `Szukam „${query}”`;
  }
  if (toolName === "get_question") {
    return `Pobieram pytanie ${displayValue(input?.question_order)}`;
  }
  return `Uruchamiam „${humanizeToolName(toolName)}”`;
}

export function ChatTool({
  part,
  interrupted = false,
}: {
  part: ChatToolPart;
  interrupted?: boolean;
}) {
  const toolName = getChatToolName(part);

  if (toolName === "generate_practice_questions") {
    return (
      <GeneratedQuestionsTool
        input={part.input}
        state={part.state}
        interrupted={interrupted}
      />
    );
  }
  if (toolName === "edit_question") {
    return (
      <EditQuestionTool
        input={part.input}
        state={part.state}
        interrupted={interrupted}
      />
    );
  }
  if (toolName === "disable_ai") {
    return <DisableAiTool input={part.input} />;
  }
  if (toolName === "list_questions") {
    return <ListQuestionsTool part={part} />;
  }
  if (toolName === "get_question") {
    return <GetQuestionTool part={part} />;
  }

  return <GenericTool part={part} toolName={toolName} />;
}

export function ChatToolGroup({
  parts,
  interrupted = false,
}: {
  parts: ChatToolPart[];
  interrupted?: boolean;
}) {
  const statuses = parts.map((part) => activityStatus(part.state));
  const running = statuses.some(
    (status) => status === "running" || status === "pending",
  );
  const failed = statuses.includes("error");
  const status: ToolActivityStatus = running
    ? "running"
    : failed
      ? "error"
      : "complete";
  const activePart = parts.findLast((part) => {
    const partStatus = activityStatus(part.state);
    return partStatus === "running" || partStatus === "pending";
  });
  const count = parts.length;
  const title =
    status === "running" && activePart !== undefined
      ? activeToolTitle(activePart)
      : status === "error"
        ? "Nie wszystkie działania się powiodły"
        : count === 1
          ? "Gotowe"
          : `Wykonano ${countLabel(count, "działanie", "działania", "działań")}`;

  return (
    <ToolActivity title={title} status={status}>
      <div className="space-y-0.5">
        {parts.map((part, index) => (
          <ChatTool
            key={part.toolCallId ?? `${part.type}-${index.toString()}`}
            part={part}
            interrupted={interrupted}
          />
        ))}
      </div>
    </ToolActivity>
  );
}
