const descriptions: Record<string, readonly [string, string]> = {
  "quizzes:read": ["Czytanie quizów i biblioteki", "Read quizzes and library"],
  "quizzes:write": [
    "Tworzenie, edycja i udostępnianie quizów",
    "Create, edit and share quizzes",
  ],
  "study:read": ["Czytanie postępów nauki", "Read study progress"],
  "study:write": [
    "Zapisywanie odpowiedzi i postępów",
    "Save answers and study progress",
  ],
  "user:read": ["Czytanie danych profilu", "Read profile information"],
  "user:write": ["Zmiana profilu i ustawień", "Change profile and settings"],
  "grades:read": ["Czytanie ocen", "Read grades"],
  "notifications:read": ["Czytanie powiadomień", "Read notifications"],
  "notifications:write": [
    "Zarządzanie powiadomieniami",
    "Manage notifications",
  ],
  "feedback:write": [
    "Przesyłanie opinii i zgłoszeń",
    "Submit feedback and reports",
  ],
  "ai:read": [
    "Czytanie ustawień i dostępnych modeli AI",
    "Read AI settings and available models",
  ],
  "ai:write": ["Korzystanie z asystenta AI", "Use the AI assistant"],
  "web:read": ["Otwieranie raportów internetowych", "Open web reports"],
};
export function permissionDescriptions(
  scopes: string,
  t: (pl: string, en: string) => string,
) {
  return [...new Set(scopes.split(/\s+/).filter(Boolean))].map((scope) => {
    const description = descriptions[scope];
    // Unrecognized scopes remain visible rather than silently hiding a grant.
    return description ? t(...description) : scope;
  });
}
