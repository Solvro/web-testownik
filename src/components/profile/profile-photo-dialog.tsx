import { useQuery } from "@tanstack/react-query";
import { ImagePlusIcon, RotateCcwIcon, UploadIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { AccountLevelBadge } from "@/components/account-level-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useUpdateProfilePhoto } from "@/hooks/use-user-profile";
import { PermissionAction, hasPermission } from "@/lib/auth/permissions";
import {
  fetchProfileAvatar,
  getGravatarUrl,
  getProfileAvatarOptions,
} from "@/lib/profile-avatars";
import { cn, getInitials } from "@/lib/utils";
import { getUserService } from "@/services";
import type { UserData } from "@/types/user";
import { ACCOUNT_LEVEL } from "@/types/user";

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "image/gif",
  "image/webp",
  "image/avif",
];
const MAX_PHOTO_SIZE = 10 * 1024 * 1024;

export function ProfilePhotoDialog({
  userData,
  onClose,
}: {
  userData: UserData;
  onClose: () => void;
}) {
  const router = useRouter();
  const mutation = useUpdateProfilePhoto();
  const fileInput = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const [upload, setUpload] = useState<{
    file: File;
    previewUrl: string;
  } | null>(null);
  const file = upload?.file ?? null;
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [resetSelected, setResetSelected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragging, setDragging] = useState(false);
  const { data: gravatarUrl = null } = useQuery({
    queryKey: ["profile-gravatar", userData.email],
    queryFn: async () => await getGravatarUrl(userData.email ?? ""),
    staleTime: Infinity,
    retry: false,
  });
  const canUpload = hasPermission(
    userData.account_type,
    PermissionAction.UPLOAD_PROFILE_PHOTO,
    userData.account_level,
  );
  const avatarOptions = getProfileAvatarOptions(
    userData.full_name,
    gravatarUrl,
  );

  useEffect(() => {
    if (upload === null) {
      return;
    }
    return () => {
      URL.revokeObjectURL(upload.previewUrl);
    };
  }, [upload]);

  const selectFiles = (files: File[]) => {
    if (saving || !canUpload || files.length === 0) {
      return;
    }
    setError(null);
    setResetSelected(false);
    if (fileInput.current !== null) {
      fileInput.current.value = "";
    }
    const selected = files[0];
    if (files.length !== 1) {
      setUpload(null);
      setSelectedAvatar(null);
      setError("Wybierz jedno zdjęcie profilowe.");
      return;
    }
    if (
      !ACCEPTED_TYPES.includes(selected.type) ||
      selected.size > MAX_PHOTO_SIZE
    ) {
      setUpload(null);
      setSelectedAvatar(null);
      setError(
        "Wybierz plik JPEG, PNG, GIF, WebP lub AVIF o rozmiarze do 10 MB.",
      );
      return;
    }
    setUpload({ file: selected, previewUrl: URL.createObjectURL(selected) });
    setSelectedAvatar(null);
  };

  const save = async (selection: File | string | null) => {
    if (saving) {
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const photo =
        typeof selection === "string"
          ? await fetchProfileAvatar(selection)
          : selection;
      await mutation.mutateAsync(photo);
    } catch {
      setError(
        "Nie udało się zapisać zdjęcia. Sprawdź połączenie lub wybierz inne zdjęcie i spróbuj ponownie.",
      );
      setSaving(false);
      return;
    }
    // The photo is already saved even if refreshing the session fails.
    try {
      const refreshed = await getUserService().refreshToken();
      if (!refreshed) {
        toast.warning(
          "Zdjęcie zapisano. Awatar w menu odświeży się po ponownym zalogowaniu.",
        );
      }
    } catch {
      toast.warning(
        "Zdjęcie zapisano. Awatar w menu odświeży się po ponownym zalogowaniu.",
      );
    }
    router.refresh();
    toast.success(
      selection === null
        ? "Przywrócono domyślne zdjęcie."
        : "Zapisano zdjęcie profilowe.",
    );
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !saving) {
          onClose();
        }
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto sm:max-w-lg"
        showCloseButton={!saving}
      >
        <DialogHeader>
          <DialogTitle>Zmień zdjęcie profilowe</DialogTitle>
        </DialogHeader>
        <div className="flex min-w-0 items-center gap-4">
          <Avatar className="size-16 shrink-0">
            <AvatarImage
              src={
                resetSelected
                  ? (userData.default_photo ?? undefined)
                  : (selectedAvatar ??
                    upload?.previewUrl ??
                    userData.photo ??
                    undefined)
              }
              alt="Podgląd zdjęcia profilowego"
            />
            <AvatarFallback className="text-2xl">
              {getInitials(userData.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-1">
            <p className="truncate font-medium">
              {resetSelected
                ? "Domyślne zdjęcie"
                : (file?.name ??
                  (selectedAvatar === null
                    ? "Aktualne zdjęcie"
                    : "Nowy awatar"))}
            </p>
            <p className="text-muted-foreground text-sm">
              {resetSelected || file !== null || selectedAvatar !== null
                ? "Podgląd - zmiany zatwierdzisz poniżej."
                : "Tak widzą Cię inni użytkownicy."}
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-medium">Gotowe awatary</h3>
          <div
            role="group"
            aria-label="Gotowe awatary"
            className="grid grid-cols-4 justify-items-center gap-3 sm:grid-cols-8 sm:gap-2"
          >
            {avatarOptions.map((url, index) => (
              <Button
                key={url}
                variant="ghost"
                className={cn(
                  "ring-offset-popover size-12 rounded-full p-0 ring-offset-2",
                  selectedAvatar === url && "ring-primary ring-2",
                )}
                aria-label={
                  url === gravatarUrl
                    ? "Gravatar"
                    : `Awatar ${String(index + 1)}`
                }
                title={url === gravatarUrl ? "Gravatar" : undefined}
                aria-pressed={selectedAvatar === url}
                disabled={saving}
                onClick={() => {
                  setSelectedAvatar(url);
                  setResetSelected(false);
                  setUpload(null);
                  if (fileInput.current !== null) {
                    fileInput.current.value = "";
                  }
                  setError(null);
                }}
              >
                <Avatar className="size-12">
                  <AvatarImage src={url} alt="" />
                  <AvatarFallback>
                    {getInitials(userData.full_name)}
                  </AvatarFallback>
                </Avatar>
              </Button>
            ))}
          </div>
        </div>
        {canUpload ? (
          <section aria-label="Własne zdjęcie" className="space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">Własne zdjęcie</h3>
              <AccountLevelBadge accountLevel={ACCOUNT_LEVEL.GOLD} />
            </div>
            <input
              ref={fileInput}
              id="profile-photo"
              type="file"
              className="hidden"
              aria-label="Wybierz plik"
              accept={ACCEPTED_TYPES.join(",")}
              disabled={saving}
              aria-describedby={
                error === null
                  ? "profile-photo-hint"
                  : "profile-photo-hint profile-photo-error"
              }
              aria-invalid={error !== null}
              onChange={(event) => {
                selectFiles([...(event.target.files ?? [])]);
              }}
            />
            <button
              type="button"
              aria-label={
                file === null ? "Dodaj własne zdjęcie" : "Zmień wybrany plik"
              }
              aria-describedby={
                error === null
                  ? "profile-photo-hint"
                  : "profile-photo-hint profile-photo-error"
              }
              disabled={saving}
              data-dragging={dragging || undefined}
              className={cn(
                "border-border text-muted-foreground hover:border-primary/60 hover:bg-muted/40 focus-visible:ring-ring flex w-full flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-5 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
                dragging && "border-primary bg-primary/10 text-primary",
              )}
              onClick={() => fileInput.current?.click()}
              onDragEnter={(event) => {
                event.preventDefault();
                if (!saving && event.dataTransfer.types.includes("Files")) {
                  dragDepth.current += 1;
                  setDragging(true);
                }
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = saving ? "none" : "copy";
              }}
              onDragLeave={(event) => {
                event.preventDefault();
                dragDepth.current = Math.max(0, dragDepth.current - 1);
                if (dragDepth.current === 0) {
                  setDragging(false);
                }
              }}
              onDrop={(event) => {
                event.preventDefault();
                dragDepth.current = 0;
                setDragging(false);
                selectFiles([...event.dataTransfer.files]);
              }}
            >
              {file === null ? (
                <UploadIcon className="size-6" aria-hidden />
              ) : (
                <ImagePlusIcon className="size-6" aria-hidden />
              )}
              <span className="text-foreground text-sm font-medium">
                {dragging
                  ? "Upuść zdjęcie tutaj"
                  : file === null
                    ? "Przeciągnij zdjęcie tutaj"
                    : "Przeciągnij inne zdjęcie tutaj"}
              </span>
              <span className="text-sm">
                lub{" "}
                <span className="text-primary underline underline-offset-4">
                  wybierz plik
                </span>
              </span>
            </button>
            <p
              id="profile-photo-hint"
              className="text-muted-foreground text-center text-xs"
            >
              JPEG, PNG, GIF, WebP, AVIF · do 10 MB
            </p>
          </section>
        ) : null}
        {error === null ? null : (
          <p
            id="profile-photo-error"
            role="alert"
            className="text-destructive text-sm"
          >
            {error}
          </p>
        )}
        <DialogFooter className="flex-row flex-wrap items-center border-t pt-4 sm:justify-between">
          {userData.has_custom_photo ? (
            <Button
              variant="ghost"
              className="mr-auto"
              aria-label="Przywróć domyślne zdjęcie"
              aria-pressed={resetSelected}
              disabled={saving}
              onClick={() => {
                setResetSelected(true);
                setSelectedAvatar(null);
                setUpload(null);
                setError(null);
                if (fileInput.current !== null) {
                  fileInput.current.value = "";
                }
              }}
            >
              <RotateCcwIcon aria-hidden />
              Reset
            </Button>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <Button variant="outline" disabled={saving} onClick={onClose}>
              Anuluj
            </Button>
            <Button
              aria-label={saving ? "Zapisywanie zdjęcia" : "Zapisz zdjęcie"}
              disabled={
                (!resetSelected && file === null && selectedAvatar === null) ||
                saving
              }
              onClick={() => {
                void save(resetSelected ? null : (selectedAvatar ?? file));
              }}
            >
              {saving ? "Zapisywanie…" : "Zapisz"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
