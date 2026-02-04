# Copilot Instructions (web-testownik)

## Kontekst projektu

- Stack: Next.js + React + TypeScript + Tailwind CSS.
- Preferuj istniejące wzorce i komponenty z `src/` oraz ustalone konwencje.

## Zasady pracy z kodem

- Zachowuj spójność z obecnym stylem i strukturą plików.
- Nie wprowadzaj nowych bibliotek bez wyraźnej potrzeby.
- Przy zmianach UI korzystaj z istniejących komponentów i klas Tailwinda.

## Wymagania `@solvro/config` (commitlint)

Stosujemy **Conventional Commits**. Format:

```
<type>(opcjonalny scope): opis w czasie teraźniejszym
```

Dozwolone typy commitów:

- `feat`
- `fix`
- `refactor`
- `chore`
- `docs`
- `ci`
- `test`
- `build`
- `release`

Inne typy (np. `perf`, `revert`, `style`) nie są akceptowane w tym projekcie.

## Opis commitów (styl)

- Opis krótki, po angielsku, opisujący czego dotyczy zmiana.
- Używaj czasu teraźniejszego (np. `add`, nie `added`).
- Pierwsza linia powinna być zwięzła i nie wykraczać poza widoczne na GitHubie miejsce.
- Dopuszczalne są zakresy, np. `feat(blog): code snippets`.

## Nazewnictwo commitów (z handbooka Solvro)

- Proponowany format: `type: short description` (lub `type(scope): short description`).
- Przedrostki z handbooka: `feat`, `fix`, `refactor`, `chore`, `docs`, `ci`, `test`.
- W tym repo obowiązują dodatkowo `build` i `release` (wynika z `@solvro/config`).
- Czasami spotkasz inne przedrostki, ale w tym repo są blokowane przez commitlint.
- Polecana specyfikacja: https://www.conventionalcommits.org/en/v1.0.0/
- Przykłady krótkiego opisu: `login view`, `shopping list`, `auth service`, `offline message widget`.

## Nazewnictwo branchy (z README)

Format:

```
<prefix>/<issue>-short-description
```

Dostępne prefiksy:

- `feat/`
- `fix/`
- `hotfix/`
- `design/`
- `refactor/`
- `test/`
- `docs/`

Przykłady:

```
feat/123-add-solvro-auth
fix/87-fix-date-display
design/45-new-color-schema
refactor/210-quiz-import-logic
docs/12-add-readme
```

## Nazewnictwo repozytoriów (handbook Solvro)

- Format: `typ-projektu-nazwa-projektu-suffixy` w pełnym lower-kebab-case.
- Prefiksy typów: `backend-`, `web-`, `lib-web-`, `ml-`, `mobile-`, `script-`.
- Gdy repo zawiera frontend i backend, preferuj rozdział, a jeśli to niemożliwe — wybierz prefiks `web-`.
