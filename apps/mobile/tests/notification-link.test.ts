import { describe, expect, it } from "vitest";

import { notificationDestination } from "../src/lib/notification-link";

const web = "http://localhost:3000";

describe("notification destinations", () => {
  it("opens quiz, editor and library links in the app", () => {
    expect(notificationDestination(`${web}/quiz/abc-1`, web)).toEqual({
      kind: "app",
      href: "/quiz/abc-1",
    });
    expect(
      notificationDestination(
        "https://testownik.solvro.pl/edit-quiz/q1/?scroll_to=question-x9",
        web,
      ),
    ).toEqual({ kind: "app", href: "/editor?id=q1&question=x9" });
    expect(notificationDestination("/quizzes", web)).toEqual({
      kind: "app",
      href: "/library",
    });
  });
  it("sends other pages and sites to the browser and ignores unsafe links", () => {
    expect(notificationDestination(`${web}/privacy-policy`, web)).toEqual({
      kind: "web",
      url: `${web}/privacy-policy`,
    });
    expect(notificationDestination("https://example.com/x", web)).toEqual({
      kind: "web",
      url: "https://example.com/x",
    });
    expect(notificationDestination("javascript:alert(1)", web)).toBeNull();
    expect(notificationDestination("", web)).toBeNull();
    expect(notificationDestination(undefined, web)).toBeNull();
  });
});
