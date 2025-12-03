import { AlertCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";

interface ImageLoadProps {
  url: string | null | undefined;
  alt: string;
  className?: string;
}

export function ImageLoad({ url, alt, className }: ImageLoadProps) {
  const [hasError, setHasError] = useState<boolean>(false);

  useEffect(() => {
    if (url == null || url === "") {
      setHasError(false);
      return;
    }

    const img = new Image();
    img.src = url;
    img.addEventListener("error", () => {
      setHasError(true);
    });
  }, [url]);

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

  return <img src={url} alt={alt} className={className} />;
}
