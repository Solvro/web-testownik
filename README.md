# <img src="https://github.com/Solvro/web-testownik/blob/main/public/favicon/180x180.png?raw=true" width="24"> Testownik Solvro - Frontend

<div align="center">

![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/react-%2320232a.svg?style=for-the-badge&logo=react&logoColor=%2361DAFB)
![Next.js](https://img.shields.io/badge/next.js-000000.svg?style=for-the-badge&logo=nextdotjs&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/tailwindcss-%2338B2AC.svg?style=for-the-badge&logo=tailwind-css&logoColor=white)

**Twoje narzędzie do nauki na Politechnice Wrocławskiej**

[🌐 Odwiedź aplikację](https://testownik.solvro.pl) • [🧑‍💻 Repozytorium backend](https://github.com/Solvro/backend-testownik)

</div>

---

## 📖 O projekcie

**Testownik Solvro** to platforma edukacyjna stworzona przez [KN Solvro](https://github.com/Solvro) dla studentów Politechniki Wrocławskiej. Aplikacja umożliwia tworzenie, rozwiązywanie i udostępnianie quizów, pomagając w przygotowaniu do sesji egzaminacyjnej.

---

## 🚀 Uruchomienie lokalne

### Wymagania

- [Node.js](https://nodejs.org/) (zalecana wersja LTS)
- pnpm (dostarczany z Node.js)

### Instalacja

1. **Sklonuj repozytorium**

   ```bash
   git clone https://github.com/Solvro/web-testownik.git
   cd web-testownik
   ```

2. **Zainstaluj zależności**

   ```bash
   pnpm install
   ```

3. **Uruchom serwer deweloperski**

   ```bash
   pnpm run dev
   ```

4. **Otwórz przeglądarkę** i przejdź do `http://localhost:3000`

---

## 📜 Dostępne skrypty

| Komenda                 | Opis                                |
| ----------------------- | ----------------------------------- |
| `pnpm run dev`          | Uruchamia serwer deweloperski z HMR |
| `pnpm run build`        | Buduje aplikację do produkcji       |
| `pnpm run start`        | Uruchamia serwer produkcyjny        |
| `pnpm run lint`         | Sprawdza kod za pomocą ESLint       |
| `pnpm run format`       | Formatuje kod za pomocą Prettier    |
| `pnpm run format:check` | Sprawdza formatowanie kodu          |
| `pnpm run typecheck`    | Sprawdza typy TypeScript            |

---

## 🛠️ Stack technologiczny

- **Framework:** [Next.js](https://nextjs.org/)
- **Stylowanie:** [Tailwind CSS](https://tailwindcss.com/)
- **Komponenty UI:** [shadcn/ui](https://ui.shadcn.com/)
- **Data Fetching:** [TanStack Query](https://tanstack.com/query/latest)
- **Testy:** [Vitest](https://vitest.dev/)
- **Ikony:** [Lucide React](https://lucide.dev/)
- **P2P:** [PeerJS](https://peerjs.com/) dla synchronizacji w czasie rzeczywistym między urządzeniami

---

## 🤝 Kontrybucja

Chcesz pomóc w rozwoju Testownika? Let's go!

1. Sforkuj repozytorium (tylko jeśli jeszcze nie jesteś w teamie testownika)
2. Stwórz branch dla swojej funkcji (`git checkout -b feat/amazing-feature`)
3. Commituj zmiany (`git commit -m 'feat: add amazing feature'`)
4. Wypchnij branch (`git push origin feat/amazing-feature`)
5. Otwórz Pull Request

Aby było nam wszystkim łatwiej stosuj się do tych zasad przy tworzeniu branchy oraz commitów.

### 🪾 Nazewnictwo branchy

Każdy branch powinien zawierać **prefiks określający typ zmiany** oraz **numer GitHub Issue** (jeżeli dotyczy).

**Format**

```
<prefix>/<issue>-short-description
```

**Dostępne prefiksy**

- `feat/` - nowe funkcje
- `fix/` - poprawki błędów
- `hotfix/` - krytyczne poprawki produkcyjne
- `design/` - zmiany UI/UX
- `refactor/` - poprawa kodu bez zmiany działania
- `test/` - testy
- `docs/` - dokumentacja

**Przykłady**

```
feat/123-add-solvro-auth
fix/87-fix-date-display
design/45-new-color-schema
refactor/210-quiz-import-logic
docs/12-add-readme
```

### ✍️ Format commitów

Stosujemy standard [**Conventional Commits**](https://www.conventionalcommits.org/en/v1.0.0/), aby się móc później łatwiej połapać.

**Format**

```
<type>(opcjonalny scope): opis w czasie teraźniejszym
```

**Typy commitów**

- `feat:` - nowa funkcjonalność
- `fix:` - naprawa błędu
- `docs:` - dokumentacja
- `refactor:` - poprawa struktury kodu
- `test:` - testy
- `chore:` - zmiany w konfiguracji, dependency itp.

**Przykłady**

```bash
feat(auth): add login with solvro auth
fix(quiz): correct randomization of questions
docs: update contribution section
refactor(api): simplify fetch wrapper
test(quiz): add missing unit tests
```

---

## 🐞 Zgłaszanie problemów, pomysłów i pytań

Jeśli nie masz pewności czy temat dotyczy frontendu czy backendu,
zgłoś go **najpierw [tutaj](https://github.com/Solvro/web-testownik/issues/new)**.

Jeśli jesteś dość pewien, że sprawa dotyczy **wyłącznie backendu**
(API, baza danych, logika serwera), wtedy wrzuć zgłoszenie w repozytorium backendu: [🧑‍💻 Repozytorium backend](https://github.com/Solvro/backend-testownik).

---

## 📬 Kontakt

- **Email:** [testownik@solvro.pl](mailto:testownik@solvro.pl)
- **Organizacja:** [KN Solvro](https://github.com/Solvro)
- **Strona:** [testownik.solvro.pl](https://testownik.solvro.pl)

---

<div align="center">

Stworzone z ❤️ przez [KN Solvro](https://github.com/Solvro) dla studentów Politechniki Wrocławskiej

⭐ Jeśli projekt Ci się podoba, zostaw gwiazdkę!

</div>
