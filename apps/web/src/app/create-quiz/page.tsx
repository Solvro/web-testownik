import type { Metadata } from "next";
import { connection } from "next/server";

import { createQuestion } from "@/components/quiz/editor/quiz-editor-factories";

import { CreateQuizPageClient } from "./client";

export const metadata: Metadata = {
  title: "Stwórz quiz",
};

export default async function CreateQuizPage() {
  await connection();
  return (
    <CreateQuizPageClient
      initialValues={{
        title: "",
        description: "",
        questions: [createQuestion(1)],
      }}
    />
  );
}
