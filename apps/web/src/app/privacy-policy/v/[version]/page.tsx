import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ArchivedLegalDocument } from "@/components/legal/legal-document-page";

interface Props {
  params: Promise<{ version: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { version } = await params;
  return {
    title: `Polityka Prywatności – wersja ${version}`,
    robots: { index: false },
  };
}

export default async function Page({ params }: Props) {
  const { version: rawVersion } = await params;
  const version = Number(rawVersion);
  if (!Number.isInteger(version) || version < 1) {
    notFound();
  }
  return <ArchivedLegalDocument kind="privacy" version={version} />;
}
