import { ImageOffIcon } from "lucide-react";
import Image from "next/image";
import { Suspense, useContext, useState } from "react";

import { ExternalImageContext } from "@/components/quiz/external-image-context";
import { isExternalUrl } from "@/components/quiz/hooks/use-external-image-approval";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ImageLoadProps {
  url: string | null | undefined;
  alt: string;
  width?: number | null;
  height?: number | null;
  className?: string;
}

export function ImageLoad({
  url,
  alt,
  width,
  height,
  className,
}: ImageLoadProps) {
  const [hasError, setHasError] = useState<boolean>(false);
  const { externalImagesApproved, isInitialized } =
    useContext(ExternalImageContext);

  if (url == null || url === "") {
    return null;
  }

  const isExternal = isExternalUrl(url);

  if (isExternal && !isInitialized) {
    return <Skeleton className={cn("min-h-40 w-1/2", className)} />;
  }

  if (isExternal && !externalImagesApproved) {
    return (
      <div className="text-muted-foreground flex w-fit items-center justify-center gap-2 rounded-md border px-3 py-2 text-sm font-medium">
        <ImageOffIcon className="size-4" />
        Zewnętrzne zdjęcia są zablokowane
      </div>
    );
  }

  if (hasError) {
    return (
      <p
        role="alert"
        className="text-destructive relative flex w-full rounded-lg px-4 py-3 text-sm"
      >
        <ImageOffIcon className="size-4" aria-hidden="true" />
        <span className="pl-2 font-bold tracking-tight">
          Nie można załadować zdjęcia
        </span>
      </p>
    );
  }

  const canUseNextImage =
    typeof width === "number" && typeof height === "number";

  return (
    <Suspense
      fallback={<Skeleton className={cn("min-h-40 w-1/2", className)} />}
    >
      {canUseNextImage ? (
        <Image
          src={url}
          alt={alt}
          width={width}
          height={height}
          className={className}
          onError={() => {
            setHasError(true);
          }}
        />
      ) : (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={url}
          alt={alt}
          className={className}
          onError={() => {
            setHasError(true);
          }}
        />
      )}
    </Suspense>
  );
}
