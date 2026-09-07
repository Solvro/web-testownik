import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUpdateProfilePhoto } from "@/hooks/use-user-profile";
import { PermissionAction, hasPermission } from "@/lib/auth/permissions";
import {
  fetchProfileAvatar,
  getProfileAvatarOptions,
} from "@/lib/profile-avatars";
import { cn, getInitials } from "@/lib/utils";
import { getUserService } from "@/services";
import type { UserData } from "@/types/user";

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
  const [file, setFile] = useState<File | null>(null);
  const [selectedAvatar, setSelectedAvatar] = useState<string | null>(null);
  const [preview, setPreview] = useState<string>();
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const canUpload = hasPermission(
    userData.account_type,
    PermissionAction.UPLOAD_PROFILE_PHOTO,
    userData.account_level,
  );
  const avatarOptions = getProfileAvatarOptions(userData.full_name);

  useEffect(() => {
    if (file === null) {
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

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
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-md"
        showCloseButton={!saving}
      >
        <DialogHeader>
          <DialogTitle>Zmień zdjęcie profilowe</DialogTitle>
          <DialogDescription>
            {canUpload
              ? "Wybierz gotowy awatar, wgraj własne zdjęcie lub przywróć zdjęcie przypisane do konta."
              : "Wybierz gotowy awatar lub przywróć zdjęcie przypisane do konta."}
          </DialogDescription>
        </DialogHeader>
        <Avatar className="mx-auto size-24">
          <AvatarImage
            src={
              selectedAvatar ??
              (file === null ? (userData.photo ?? undefined) : preview)
            }
            alt="Podgląd zdjęcia profilowego"
          />
          <AvatarFallback>{getInitials(userData.full_name)}</AvatarFallback>
        </Avatar>
        <div
          role="group"
          aria-label="Gotowe awatary"
          className="grid grid-cols-4 justify-items-center gap-3"
        >
          {avatarOptions.map((url, index) => (
            <Button
              key={url}
              variant="ghost"
              className={cn(
                "size-12 rounded-full p-0 sm:size-16",
                selectedAvatar === url && "ring-primary ring-2",
              )}
              aria-label={`Awatar ${String(index + 1)}`}
              aria-pressed={selectedAvatar === url}
              disabled={saving}
              onClick={() => {
                setSelectedAvatar(url);
                setFile(null);
                if (fileInput.current !== null) {
                  fileInput.current.value = "";
                }
                setError(null);
              }}
            >
              <Avatar className="size-12 sm:size-16">
                <AvatarImage src={url} alt="" />
                <AvatarFallback>
                  {getInitials(userData.full_name)}
                </AvatarFallback>
              </Avatar>
            </Button>
          ))}
        </div>
        {canUpload ? (
          <div className="space-y-2">
            <Label htmlFor="profile-photo">Wybierz plik</Label>
            <Input
              ref={fileInput}
              id="profile-photo"
              type="file"
              accept={ACCEPTED_TYPES.join(",")}
              disabled={saving}
              aria-describedby="profile-photo-hint profile-photo-error"
              aria-invalid={error !== null}
              onChange={(event) => {
                const selected = event.target.files?.[0];
                setError(null);
                if (selected === undefined) {
                  return;
                }
                if (
                  !ACCEPTED_TYPES.includes(selected.type) ||
                  selected.size > MAX_PHOTO_SIZE
                ) {
                  setFile(null);
                  setSelectedAvatar(null);
                  event.target.value = "";
                  setError(
                    "Wybierz plik JPEG, PNG, GIF, WebP lub AVIF o rozmiarze do 10 MB.",
                  );
                  return;
                }
                setFile(selected);
                setSelectedAvatar(null);
              }}
            />
            <p
              id="profile-photo-hint"
              className="text-muted-foreground text-sm"
            >
              JPEG, PNG, GIF, WebP lub AVIF. Maksymalnie 10 MB.
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground text-sm">
            Własne zdjęcia możesz wgrywać z kontem Gold.
          </p>
        )}
        {error === null ? null : (
          <p
            id="profile-photo-error"
            role="alert"
            className="text-destructive text-sm"
          >
            {error}
          </p>
        )}
        {userData.has_custom_photo ? (
          <Button
            variant="outline"
            disabled={saving}
            onClick={() => {
              void save(null);
            }}
          >
            Przywróć domyślne zdjęcie
          </Button>
        ) : null}
        <DialogFooter>
          <Button variant="outline" disabled={saving} onClick={onClose}>
            Anuluj
          </Button>
          <Button
            disabled={(file === null && selectedAvatar === null) || saving}
            onClick={() => {
              void save(selectedAvatar ?? file);
            }}
          >
            {saving ? "Zapisywanie…" : "Zapisz zdjęcie"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
