import { AlertCircleIcon } from "lucide-react";
import { Suspense, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ImageLoadProps {
  url: string | null | undefined;
  alt: string;
  className?: string;
}

export function ImageLoad({ url, alt, className }: ImageLoadProps) {
  const [hasError, setHasError] = useState<boolean>(false);

  if (url == null || url === "") {
    return null;
  }

  if (hasError) {
    return (
      <p
        role="alert"
        className="text-destructive relative flex w-full rounded-lg px-4 py-3 text-sm"
      >
        <AlertCircleIcon className="size-4" aria-hidden="true" />
        <span className="pl-2 font-bold tracking-tight">
          Nie można załadować obrazka
        </span>
      </p>
    );
  }

  return (
    <Suspense
      fallback={<Skeleton className={cn("min-h-40 w-1/2", className)} />}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        className={className}
        onError={() => {
          setHasError(true);
        }}
      />
    </Suspense>
  );
}
