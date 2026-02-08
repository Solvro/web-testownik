import { ImageResponse } from "next/og";
import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { env } from "@/env";
import { API_URL } from "@/lib/api";
import type { QuizMetadata } from "@/types/quiz";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

const fontPath = path.join(process.cwd(), "src", "assets", "og-image", "fonts");

let fontsCache:
  | {
      name: string;
      data: Buffer;
      weight: 400 | 500 | 600 | 700;
      style: "normal" | "italic";
    }[]
  | null = null;

async function getFonts() {
  if (fontsCache != null) {
    return fontsCache;
  }

  const [regular, medium, semiBold, bold] = await Promise.all([
    readFile(path.join(fontPath, "HankenGrotesk-Regular.ttf")),
    readFile(path.join(fontPath, "HankenGrotesk-Medium.ttf")),
    readFile(path.join(fontPath, "HankenGrotesk-SemiBold.ttf")),
    readFile(path.join(fontPath, "HankenGrotesk-Bold.ttf")),
  ]);

  fontsCache = [
    {
      name: "Hanken Grotesk",
      data: regular,
      weight: 400,
      style: "normal",
    },
    {
      name: "Hanken Grotesk",
      data: medium,
      weight: 500,
      style: "normal",
    },
    {
      name: "Hanken Grotesk",
      data: semiBold,
      weight: 600,
      style: "normal",
    },
    {
      name: "Hanken Grotesk",
      data: bold,
      weight: 700,
      style: "normal",
    },
  ];

  return fontsCache;
}

function Badge({
  icon,
  text,
  avatarInitial,
  avatarUrl,
}: {
  icon?: React.ReactNode;
  text: string;
  avatarInitial?: string;
  avatarUrl?: string | null;
}) {
  return (
    <div tw="flex mr-4 items-center px-4 py-2 rounded-xl border border-[#283E66] bg-[#0D1320]/40">
      {avatarUrl == null ? (
        avatarInitial == null ? null : (
          <div
            tw="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xl mr-2"
            style={{
              backgroundImage:
                "linear-gradient(94deg, #408CFF -5.87%, #1D5BB9 100%)",
            }}
          >
            {avatarInitial}
          </div>
        )
      ) : (
        <img
          src={avatarUrl}
          alt=""
          tw="w-10 h-10 rounded-full mr-2"
          style={{ objectFit: "cover" }}
        />
      )}

      {icon == null ? null : (
        <div tw="mr-2 flex items-center justify-center">{icon}</div>
      )}
      <div tw="text-[#E2E7EE] text-[32px] font-medium flex">{text}</div>
    </div>
  );
}

function AnswerOption({
  text,
  isFirst = false,
}: {
  text: string;
  isFirst?: boolean;
}) {
  return (
    <div
      tw={`text-slate-200 text-[14px] items-center h-[34px] w-full ${isFirst ? "mt-0" : "mt-[10px]"}`}
      style={{
        display: "block",
        lineClamp: 1,
      }}
    >
      {text}
    </div>
  );
}

// eslint-disable-next-line import/no-default-export
export default async function Image({
  params,
}: {
  params: Promise<{ quizId: string }>;
}) {
  const { quizId } = await params;

  const fontsPromise = getFonts();
  const bgImagePromise = readFile(
    path.join(process.cwd(), "src", "assets", "og-image", "background.png"),
  ).catch((error: unknown) => {
    console.error("Failed to load og-background.png", error);
    return null;
  });

  const quizPromise = fetch(
    `${API_URL}/quizzes/${quizId}/metadata?include=preview_question`,
    {
      method: "GET",
      headers: {
        "Api-Key": env.INTERNAL_API_KEY ?? "",
      },
      next: { revalidate: 60 },
    },
  )
    .then(async (response) => {
      if (!response.ok) {
        return null;
      }
      return response.json() as Promise<QuizMetadata>;
    })
    .catch((error: unknown) => {
      console.error("Failed to fetch quiz:", error);
      return null;
    });

  const [fonts, bgImageData, quiz] = await Promise.all([
    fontsPromise,
    bgImagePromise,
    quizPromise,
  ]);

  const bgImageSource =
    bgImageData == null
      ? undefined
      : `data:image/png;base64,${bgImageData.toString("base64")}`;

  if (quiz == null) {
    // TODO: Replace with a proper fallback image
    const fallbackImageBuffer = await readFile(
      path.join(process.cwd(), "public", "favicon", "180x180.png"),
    );
    return new NextResponse(fallbackImageBuffer, {
      headers: {
        "Content-Type": "image/png",
      },
    });
  }

  const questionTitle = quiz.preview_question?.text ?? "Ile to jest 2+2?";

  const answers =
    quiz.preview_question == null
      ? []
      : quiz.preview_question.answers.slice(0, 3);

  const renderAnswers = [0, 1, 2].map((index) => {
    return answers[index]?.text ?? ((index + 9) % 5).toString();
  });

  const shouldShowAuthor = !quiz.is_anonymous && quiz.maintainer != null;

  return new ImageResponse(
    <div
      tw="w-full h-full relative bg-[#0D1320] flex overflow-hidden"
      style={{ fontFamily: '"Hanken Grotesk"' }}
    >
      {bgImageSource == null ? null : (
        <img
          src={bgImageSource}
          tw="absolute inset-0 w-full h-full"
          style={{ objectFit: "cover" }}
          alt="Background"
        />
      )}

      {/* --- LEFT CONTENT AREA: Title & Badges --- */}
      <div tw="flex flex-col absolute left-[60px] top-[70px] w-[750px]">
        {/* Quiz Title */}
        <div
          tw="text-[#F3F5F8] text-[84px] leading-[1.1] font-semibold mb-6 "
          style={{
            display: "block",
            lineClamp: 2,
          }}
        >
          {quiz.title}
        </div>

        {/* Badges Row */}
        <div tw="flex">
          {/* Badge 1: Author */}
          {shouldShowAuthor ? (
            <Badge
              avatarUrl={quiz.maintainer?.photo}
              avatarInitial={quiz.maintainer?.full_name.charAt(0)}
              text={quiz.maintainer?.full_name ?? ""}
            />
          ) : null}

          {/* Badge 2: Question Count */}
          <Badge
            icon={
              <svg
                width="47"
                height="47"
                viewBox="0 0 47 47"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M5.85954 32.0031C6.14749 32.7294 6.2116 33.5253 6.04363 34.2884L3.958 40.7313C3.8908 41.0581 3.90817 41.3966 4.00848 41.7147C4.10878 42.0329 4.28869 42.3201 4.53114 42.5492C4.77359 42.7783 5.07055 42.9417 5.39385 43.0239C5.71715 43.106 6.05608 43.1042 6.3785 43.0187L13.0623 41.0643C13.7824 40.9214 14.5282 40.9839 15.2145 41.2444C19.3963 43.1973 24.1335 43.6105 28.5902 42.411C33.047 41.2116 36.9369 38.4766 39.5736 34.6887C42.2104 30.9007 43.4245 26.3031 43.0019 21.7072C42.5792 17.1113 40.5469 12.8123 37.2635 9.56877C33.9801 6.32524 29.6566 4.34559 25.0559 3.9791C20.4551 3.61261 15.8728 4.88284 12.1173 7.56567C8.3618 10.2485 5.67454 14.1715 4.52962 18.6426C3.38471 23.1137 3.85572 27.8454 5.85954 32.0031Z"
                  stroke="#E2E7EE"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M17.8013 17.6249C18.2617 16.3161 19.1704 15.2124 20.3666 14.5094C21.5628 13.8065 22.9691 13.5495 24.3366 13.784C25.704 14.0186 26.9444 14.7295 27.8379 15.791C28.7314 16.8524 29.2204 18.1958 29.2184 19.5832C29.2184 23.4999 23.3434 25.4582 23.3434 25.4582"
                  stroke="#E2E7EE"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <path
                  d="M23.5 33.2917H23.5177"
                  stroke="#E2E7EE"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            }
            text={`${(quiz.question_count ?? 0).toString()} pytań`}
          />
        </div>
      </div>

      {/* --- RIGHT CONTENT AREA: Phone Mockup Overlay --- */}
      <div tw="flex flex-col absolute right-[80px] bottom-0 h-[284px] w-[267px] pt-2 px-[14px] overflow-hidden">
        {/* Upper Section */}
        <div tw="flex flex-col">
          {/* Inner Phone Title - Single Line */}
          <div
            tw="text-slate-200 text-[16px] leading-[1.3] items-center h-[28px] flex font-medium w-[200px] overflow-hidden"
            style={{
              display: "block",
              lineClamp: 1,
            }}
          >
            {quiz.title}
          </div>

          {/* Inner Phone Stats */}
          <div tw="mt-[9px] flex justify-between">
            {/* Stat 1 */}
            <div tw="text-slate-200 text-[14px] h-[30px] items-center justify-center  flex font-medium w-[114px] overflow-hidden">
              <svg
                width="19"
                height="19"
                viewBox="0 0 19 19"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g clipPath="url(#clip0_785_1248)">
                  <path
                    d="M2.27506 12.4261C2.38686 12.7082 2.41176 13.0172 2.34653 13.3135L1.53673 15.8151C1.51064 15.942 1.51738 16.0734 1.55633 16.197C1.59527 16.3205 1.66513 16.432 1.75927 16.521C1.85341 16.6099 1.96871 16.6734 2.09424 16.7053C2.21977 16.7372 2.35137 16.7365 2.47656 16.7033L5.07173 15.9444C5.35134 15.8889 5.6409 15.9132 5.90739 16.0144C7.5311 16.7726 9.37044 16.9331 11.1009 16.4673C12.8314 16.0016 14.3417 14.9397 15.3655 13.4689C16.3893 11.9981 16.8608 10.213 16.6966 8.42847C16.5325 6.64397 15.7434 4.97476 14.4686 3.71537C13.1937 2.45597 11.515 1.68732 9.72859 1.54502C7.94221 1.40272 6.16298 1.89592 4.70481 2.93761C3.24663 3.97929 2.20323 5.50252 1.75868 7.23854C1.31413 8.97456 1.49701 10.8118 2.27506 12.4261Z"
                    stroke="#E2E7EE"
                    strokeWidth="1.52076"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M6.91162 6.8435C7.09039 6.33531 7.44324 5.90679 7.90768 5.63384C8.37213 5.36088 8.91818 5.2611 9.44914 5.35218C9.9801 5.44325 10.4617 5.7193 10.8086 6.13142C11.1556 6.54355 11.3454 7.06517 11.3446 7.60388C11.3446 9.12464 9.0635 9.88502 9.0635 9.88502"
                    stroke="#E2E7EE"
                    strokeWidth="1.52076"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9.12451 12.9265H9.13082"
                    stroke="#E2E7EE"
                    strokeWidth="1.52076"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_785_1248">
                    <rect width="18.2491" height="18.2491" fill="white" />
                  </clipPath>
                </defs>
              </svg>
              <span tw="ml-1">
                {Math.floor((quiz.question_count ?? 25) / 9)}/
                {quiz.question_count ?? 25}
              </span>
            </div>

            {/* Stat 2 */}
            <div tw="text-slate-200 text-[14px] h-[30px] items-center justify-center flex font-medium w-[114px] overflow-hidden">
              <svg
                width="19"
                height="19"
                viewBox="0 0 19 19"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <g clipPath="url(#clip0_785_1255)">
                  <path
                    d="M7.604 1.52075H10.6455"
                    stroke="#E2E7EE"
                    strokeWidth="1.52076"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9.12451 10.6454L11.4057 8.36426"
                    stroke="#E2E7EE"
                    strokeWidth="1.52076"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9.12454 16.7283C12.4841 16.7283 15.2076 14.0049 15.2076 10.6453C15.2076 7.28572 12.4841 4.56226 9.12454 4.56226C5.76497 4.56226 3.0415 7.28572 3.0415 10.6453C3.0415 14.0049 5.76497 16.7283 9.12454 16.7283Z"
                    stroke="#E2E7EE"
                    strokeWidth="1.52076"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </g>
                <defs>
                  <clipPath id="clip0_785_1255">
                    <rect width="18.2491" height="18.2491" fill="white" />
                  </clipPath>
                </defs>
              </svg>
              <span tw="ml-1">00:15</span>
            </div>
          </div>
        </div>

        {/* Lower Screen */}
        <div tw="flex flex-col">
          {/* Question Text */}
          <div
            tw="mt-[43px] text-slate-200 text-[14px] leading-[1.3] items-center h-[60px] flex font-medium w-full"
            style={{
              display: "block",
              lineClamp: 2,
            }}
          >
            {questionTitle}
          </div>

          <div tw="flex flex-col px-2" style={{ display: "flex" }}>
            {renderAnswers.map((ans, index) => (
              <AnswerOption
                key={`${ans}-${index.toString()}`}
                text={ans}
                isFirst={index === 0}
              />
            ))}
          </div>
        </div>
      </div>
    </div>,
    {
      ...size,
      fonts,
    },
  );
}
