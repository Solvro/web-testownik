"use client";

import { format } from "date-fns";
import {
  CalendarIcon,
  ClockIcon,
  FileTextIcon,
  PencilIcon,
  UserIcon,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { QuizMetadata } from "@/types/quiz";

interface StatsInfoCardProps {
  quiz: QuizMetadata;
  lastActivityAt: string | null;
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div className="flex items-center gap-3 text-sm">
      <Icon className="text-muted-foreground size-4 shrink-0" />
      <div className="flex flex-1 items-baseline justify-between gap-2">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{value ?? "—"}</span>
      </div>
    </div>
  );
}

function formatDate(dateString: string | null | undefined): string | null {
  if (dateString == null) {
    return null;
  }
  return format(new Date(dateString), "dd.MM.yyyy HH:mm");
}

export function StatsInfoCard({ quiz, lastActivityAt }: StatsInfoCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileTextIcon className="size-5" />
          Informacje
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <InfoRow
          icon={CalendarIcon}
          label="Utworzono"
          value={formatDate(quiz.created_at)}
        />
        <InfoRow
          icon={PencilIcon}
          label="Ostatnia edycja"
          value={formatDate(quiz.updated_at)}
        />
        <InfoRow
          icon={ClockIcon}
          label="Ostatnio uruchomiony"
          value={formatDate(lastActivityAt ?? quiz.last_used_at)}
        />
        <InfoRow
          icon={FileTextIcon}
          label="Liczba pytań"
          value={quiz.question_count?.toString() ?? "—"}
        />
        <InfoRow
          icon={UserIcon}
          label="Twórca"
          value={quiz.creator?.full_name ?? "Anonimowy"}
        />
      </CardContent>
    </Card>
  );
}
