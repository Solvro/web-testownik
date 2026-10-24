"use client";

import { ACCOUNT_TYPE } from "@testownik/core/user/types";
import type { UserData } from "@testownik/core/user/types";
import { AlertCircleIcon, RotateCcwIcon, UserIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { PermissionAction, hasPermission } from "@/lib/auth/permissions";
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
  const canChangeName = hasPermission(
    userData.account_type,
    PermissionAction.EDIT_PROFILE_NAME,
    userData.account_level,
  );
  const isGuest = userData.account_type === ACCOUNT_TYPE.GUEST;

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
  const hasChanges = !isUnchanged;
  const isEmpty = firstName.trim().length === 0 && lastName.trim().length === 0;

  const handleReset = () => {
    setFirstName(initialFirstName);
    setLastName(initialLastName);
    setError(null);
  };

  const handleSave = async (event?: React.SyntheticEvent) => {
    if (event !== undefined) {
      event.preventDefault();
    }
    if (saving || !canChangeName) {
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
            {canChangeName
              ? "Wprowadź nowe imię i nazwisko, które będą wyświetlane w Twoim profilu."
              : "Informacje o możliwości zmiany nazwy dla Twojego typu konta."}
          </DialogDescription>
        </DialogHeader>

        {canChangeName ? null : isGuest ? (
          <Alert variant="destructive">
            <AlertCircleIcon className="size-4" />
            <AlertTitle>Funkcja niedostępna w trybie gościa</AlertTitle>
            <AlertDescription>
              Zaloguj się na swoje konto, aby móc edytować profil.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert>
            <AlertCircleIcon className="size-4" />
            <AlertTitle>Imię i nazwisko pobierane z USOS</AlertTitle>
            <AlertDescription>
              Twoje dane profilowe są automatycznie pobierane z systemu USOS i
              nie mogą być edytowane w serwisie. Aby zmienić dane osobowe,
              skontaktuj się z dziekanatem uczelni lub napisz do nas pod
              adresem:{" "}
              <a
                className="font-medium underline"
                href="mailto:kn.solvro@pwr.edu.pl"
              >
                kn.solvro@pwr.edu.pl
              </a>
              .
            </AlertDescription>
          </Alert>
        )}

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

        {canChangeName ? (
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
        ) : null}

        {error === null ? null : (
          <p
            id="profile-name-error"
            role="alert"
            className="text-destructive text-sm"
          >
            {error}
          </p>
        )}

        <DialogFooter className="flex-row flex-wrap items-center border-t pt-4 sm:justify-between">
          {canChangeName && hasChanges ? (
            <Button
              type="button"
              variant="ghost"
              className="mr-auto"
              disabled={saving}
              onClick={handleReset}
            >
              <RotateCcwIcon aria-hidden className="size-4" />
              Resetuj
            </Button>
          ) : null}
          <div className="ml-auto flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={onClose}
            >
              {canChangeName ? "Anuluj" : "Zamknij"}
            </Button>
            {canChangeName ? (
              <Button
                type="submit"
                form="profile-change-name-form"
                disabled={saving || isUnchanged || isEmpty}
              >
                {saving ? "Zapisywanie…" : "Zapisz"}
              </Button>
            ) : null}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
