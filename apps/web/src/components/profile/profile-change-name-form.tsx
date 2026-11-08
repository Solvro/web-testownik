"use client";

import type { UserData } from "@testownik/core/user/types";
import { UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { useUpdateUserProfile } from "@/hooks/use-user-profile";
import { getInitials } from "@/lib/utils";
import { getUserService } from "@/services";

export interface ProfileChangeNameFormProps {
  userData: UserData;
  onClose: () => void;
}

export function ProfileChangeNameForm({
  userData,
  onClose,
}: ProfileChangeNameFormProps) {
  const router = useRouter();
  const updateUserProfile = useUpdateUserProfile();
  const initialFirstName = userData.first_name.trim();
  const initialLastName = userData.last_name.trim();

  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const previewFullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const isUnchanged =
    firstName.trim() === initialFirstName &&
    lastName.trim() === initialLastName;
  const isEmpty = firstName.trim().length === 0 && lastName.trim().length === 0;

  const handleSave = async (event?: React.SyntheticEvent) => {
    if (event !== undefined) {
      event.preventDefault();
    }
    if (saving) {
      return;
    }

    const trimmedFirst = firstName.trim();
    const trimmedLast = lastName.trim();

    if (trimmedFirst.length === 0 && trimmedLast.length === 0) {
      setError("Wprowadź imię lub nazwisko.");
      return;
    }

    if (isUnchanged) {
      onClose();
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateUserProfile.mutateAsync({
        first_name: trimmedFirst,
        last_name: trimmedLast,
      });
    } catch (error_: unknown) {
      console.error("Failed to update profile name:", error_);
      setError("Nie udało się zaktualizować nazwy profilu. Spróbuj ponownie.");
      setSaving(false);
      return;
    }

    let refreshed = false;
    try {
      refreshed = await getUserService().refreshToken();
    } catch {
      // The profile was saved even if refreshing the session failed.
    }

    if (refreshed) {
      toast.success("Zapisano zmiany w profilu.");
    } else {
      toast.warning(
        "Nazwę zapisano. Może minąć chwila, zanim zaktualizuje się w menu.",
      );
    }

    router.refresh();
    onClose();
  };

  return (
    <Dialog
      open
      onOpenChange={(isOpen) => {
        if (!isOpen && !saving) {
          onClose();
        }
      }}
    >
      <DialogContent
        className="max-h-[calc(100dvh-2rem)] gap-6 overflow-y-auto sm:max-w-md"
        showCloseButton={!saving}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserIcon className="size-5" />
            Zmień nazwę profilu
          </DialogTitle>
          <DialogDescription>
            Wprowadź nowe imię i nazwisko, które będą wyświetlane w Twoim
            profilu.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/40 flex min-w-0 items-center gap-4 rounded-lg border p-3">
          <Avatar className="size-14 shrink-0">
            <AvatarImage
              src={userData.photo ?? undefined}
              alt={`Podgląd zdjęcia użytkownika ${previewFullName}`}
            />
            <AvatarFallback className="text-xl">
              {getInitials(previewFullName || userData.full_name)}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 space-y-0.5">
            <p className="text-muted-foreground text-xs font-medium">
              Podgląd wyświetlanej nazwy:
            </p>
            <p className="truncate text-base font-semibold">
              {previewFullName.trim() === "" ? "Ustaw nazwę" : previewFullName}
            </p>
            <p className="text-muted-foreground truncate text-xs">
              {userData.email ?? userData.student_number}
            </p>
          </div>
        </div>

        <form
          id="profile-change-name-form"
          onSubmit={handleSave}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="first_name">Imię</Label>
            <Input
              id="first_name"
              aria-invalid={error !== null}
              aria-describedby={
                error === null ? undefined : "profile-name-error"
              }
              value={firstName}
              onChange={(event) => {
                setFirstName(event.target.value);
                if (error !== null) {
                  setError(null);
                }
              }}
              disabled={saving}
              placeholder="Wpisz imię"
              maxLength={30}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Nazwisko</Label>
            <Input
              id="last_name"
              aria-invalid={error !== null}
              aria-describedby={
                error === null ? undefined : "profile-name-error"
              }
              value={lastName}
              onChange={(event) => {
                setLastName(event.target.value);
                if (error !== null) {
                  setError(null);
                }
              }}
              disabled={saving}
              placeholder="Wpisz nazwisko"
              maxLength={51}
            />
          </div>
          <button
            type="submit"
            className="hidden"
            aria-hidden="true"
            tabIndex={-1}
          />
        </form>

        {error === null ? null : (
          <p
            id="profile-name-error"
            role="alert"
            className="text-destructive text-sm"
          >
            {error}
          </p>
        )}

        <DialogFooter className="border-t pt-4">
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={onClose}
          >
            Anuluj
          </Button>
          <Button
            type="submit"
            form="profile-change-name-form"
            disabled={saving || isUnchanged || isEmpty}
          >
            {saving ? "Zapisywanie…" : "Zapisz"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
