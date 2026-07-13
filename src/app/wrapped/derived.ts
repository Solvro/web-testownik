import type { WrappedPersona } from "@/types/wrapped";

export function formatStudyDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  return `${String(Math.floor(minutes / 60))} godz ${String(minutes % 60).padStart(2, "0")} min`;
}

export function peakHourLabel(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

export function personaForHour(
  hour: number,
  { isGlobal = false }: { isGlobal?: boolean } = {},
): WrappedPersona {
  if (hour >= 0 && hour <= 4) {
    return {
      name: "Nocny Marek",
      description: isGlobal
        ? "Najwięcej odpowiedzi padało głęboko w nocy."
        : "Najwięcej odpowiedzi udzielasz głęboko w nocy.",
    };
  }
  if (hour >= 5 && hour <= 8) {
    return {
      name: "Ranny Ptaszek",
      description: isGlobal
        ? "Najwięcej odpowiedzi padało tuż po przebudzeniu."
        : "Najwięcej odpowiedzi udzielasz tuż po przebudzeniu.",
    };
  }
  if (hour >= 9 && hour <= 11) {
    return {
      name: "Poranny Umysł",
      description: isGlobal
        ? "Testownik najlepiej rozkręcał się przed południem."
        : "Najlepiej rozkręcasz się przed południem.",
    };
  }
  if (hour >= 12 && hour <= 16) {
    return {
      name: "Popołudniowy Maratończyk",
      description: isGlobal
        ? "Najwięcej odpowiedzi padało po południu."
        : "Najwięcej odpowiedzi udzielasz po południu.",
    };
  }
  if (hour >= 17 && hour <= 20) {
    return {
      name: "Wieczorny Strateg",
      description: isGlobal
        ? "Najwięcej odpowiedzi padało wieczorem."
        : "Najwięcej odpowiedzi udzielasz wieczorem.",
    };
  }
  return {
    name: "Nocny Marek",
    description: isGlobal
      ? "Najwięcej odpowiedzi padało tuż przed północą."
      : "Najwięcej odpowiedzi udzielasz tuż przed północą.",
  };
}
