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
import { getInitials } from "@/lib/utils";
import { getUserService } from "@/services";

export interface ProfileChangeNameFormProps {
  userData: UserData;
  onClose: () => void;
  open?: boolean;
}

export function ProfileChangeNameForm({
  userData,
  onClose,
  open = true,
}: ProfileChangeNameFormProps) {
  const router = useRouter();
  const updateUserProfile = useUpdateUserProfile();

  const canChangeName = userData.account_type === ACCOUNT_TYPE.EMAIL;
  const isGuest = userData.account_type === ACCOUNT_TYPE.GUEST;

  const fullNameParts = userData.full_name.split(" ");
  const initialFirstName = (userData.first_name ?? fullNameParts[0]).trim();
  const initialLastName = (
    userData.last_name ?? fullNameParts.slice(1).join(" ")
  ).trim();

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
    if (trimmedFirst.length > 30) {
      setError("Imię może mieć maksymalnie 30 znaków.");
      return;
    }
    if (trimmedLast.length > 51) {
      setError("Nazwisko może mieć maksymalnie 51 znaków.");
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
      toast.error("Wystąpił błąd podczas zapisywania profilu.");
      setSaving(false);
      return;
    }

    try {
      const refreshed = await getUserService().refreshToken();
      if (!refreshed) {
        toast.warning(
          "Nazwę zapisano. Może minąć chwila, zanim zaktualizuje się w menu.",
        );
      }
    } catch {
      toast.warning(
        "Nazwę zapisano. Może minąć chwila, zanim zaktualizuje się w menu.",
      );
    }

    router.refresh();
    toast.success("Zapisano zmiany w profilu.");
    onClose();
  };

  return (
    <Dialog
      open={open}
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
          <form onSubmit={handleSave} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="first_name">Imię</Label>
              <Input
                id="first_name"
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
          </form>
        ) : null}

        {error === null ? null : (
          <p role="alert" className="text-destructive text-sm">
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
                type="button"
                disabled={saving || isUnchanged || isEmpty}
                onClick={() => void handleSave()}
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

export const ProfileChangeNameDialog = ProfileChangeNameForm;
