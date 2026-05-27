import type { Answer, Question, Quiz } from "@/types/quiz";

const blobToDataUrl = async (blob: Blob): Promise<string> =>
  await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Failed to convert image to data URL."));
      }
    });
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("Failed to convert image to data URL."));
    });
    reader.readAsDataURL(blob);
  });

const imageUrlToDataUrl = async (imageUrl: string): Promise<string> => {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${imageUrl}`);
  }

  const blob = await response.blob();

  return await blobToDataUrl(blob);
};

const prepareImageForDownload = async (
  item: Pick<Answer | Question, "image" | "image_url" | "image_upload">,
): Promise<string | undefined> => {
  const imageUrl = item.image ?? item.image_url ?? undefined;
  if (imageUrl === undefined || imageUrl === "") {
    return;
  }

  if (item.image_upload != null && item.image_upload !== "") {
    return await imageUrlToDataUrl(imageUrl);
  }

  return imageUrl;
};

const pickAnswerFields = async (answer: Answer) => ({
  id: answer.id,
  order: answer.order,
  text: answer.text,
  is_correct: answer.is_correct,
  image_url: await prepareImageForDownload(answer),
});

const pickQuestionFields = async (question: Question) => ({
  id: question.id,
  order: question.order,
  text: question.text,
  explanation: question.explanation ?? undefined,
  multiple: question.multiple,
  image_url: await prepareImageForDownload(question),
  answers: await Promise.all(
    question.answers.map(async (a) => await pickAnswerFields(a)),
  ),
});

export async function prepareQuizForDownload(quiz: Quiz) {
  return {
    comment: quiz.questions.some(
      (q) =>
        (q.image_upload != null && q.image_upload !== "") ||
        q.answers.some((a) => a.image_upload != null && a.image_upload !== ""),
    )
      ? "Ten quiz zawiera pytania ze zdjęciami. Zdjęcia przesłane do Testownika zostały zapisane w pliku JSON jako base64. Podczas importu quizu zostaną automatycznie przesłane do Testownika."
      : undefined,
    title: quiz.title,
    description: quiz.description,
    version: quiz.version,
    questions: await Promise.all(
      quiz.questions.map(async (q) => await pickQuestionFields(q)),
    ),
  };
}
