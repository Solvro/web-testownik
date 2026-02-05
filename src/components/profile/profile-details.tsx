import { IdCardLanyardIcon, PencilIcon } from "lucide-react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import { toast } from "sonner";

import { AppContext } from "@/app-context";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn, getInitials } from "@/lib/utils";
import type { UserData } from "@/types/user";

interface ProfileDetailsProps {
  userData: UserData | null;
  loading: boolean;
  setUserData: (data: UserData) => void;
}

export function ProfileDetails({
  userData,
  loading,
  setUserData,
}: ProfileDetailsProps) {
  const appContext = useContext(AppContext);
  const router = useRouter();
  const [showDialog, setShowDialog] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(userData?.photo ?? "");

  useEffect(() => {
    // eslint-disable-next-line react-you-might-not-need-an-effect/no-derived-state
    setSelectedPhoto(userData?.photo ?? "");
  }, [userData?.photo]);

  const handleOpenDialog = () => {
    setShowDialog(true);
  };
  const handleCloseDialog = () => {
    setSelectedPhoto(userData?.photo ?? "");
    setShowDialog(false);
  };

  const handleSavePhoto = () => {
    handleCloseDialog();
    appContext.services.user
      .updateUserProfile({
        overriden_photo_url:
          selectedPhoto === userData?.photo_url ? null : selectedPhoto,
      })
      .then(async () => {
        if (userData !== null) {
          setUserData({ ...userData, photo: selectedPhoto });
          // Refresh token to get updated user data (avatar) in the token payload
          await appContext.services.user.refreshToken();
          appContext.setAuthenticated(true);
        }
      })
      .catch((error: unknown) => {
        console.error("Error saving photo:", error);
        toast.error("Wystąpił błąd podczas zapisywania zdjęcia profilowego.");
      });
  };

  const handleHideProfile = (hide: boolean) => {
    appContext.services.user
      .updateUserProfile({ hide_profile: hide })
      .then(() => {
        if (userData !== null) {
          setUserData({ ...userData, hide_profile: hide });
        }
      })
      .catch((error: unknown) => {
        console.error("Error saving photo:", error);
        toast.error("Wystąpił błąd podczas zapisywania zdjęcia profilowego.");
      });
  };

  const avatarOptions = [
    userData?.photo_url ?? "",
    encodeURI(
      `https://api.dicebear.com/9.x/adventurer/svg?seed=${userData?.full_name ?? "default"}`,
    ),
    encodeURI(
      `https://api.dicebear.com/9.x/adventurer/svg?seed=${userData?.full_name ?? "default"} 2`,
    ),
    encodeURI(
      `https://api.dicebear.com/9.x/adventurer/svg?seed=${userData?.full_name ?? "default"} 3`,
    ),
    encodeURI(
      `https://api.dicebear.com/9.x/dylan/svg?seed=${userData?.full_name ?? "default"}`,
    ),
    encodeURI(
      `https://api.dicebear.com/9.x/micah/svg?seed=${userData?.full_name ?? "default"}`,
    ),
    encodeURI(
      `https://api.dicebear.com/9.x/micah/svg?seed=${userData?.full_name ?? "default"} 2`,
    ),
    encodeURI(
      `https://api.dicebear.com/9.x/shapes/svg?seed=${userData?.full_name ?? "default"}`,
    ),
    encodeURI(
      `https://api.dicebear.com/9.x/initials/svg?seed=${userData?.full_name ?? "default"}`,
    ),
  ];

  if (appContext.isGuest) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center py-8 text-center">
          <IdCardLanyardIcon className="text-muted-foreground size-24" />
          <h1 className="mt-4 text-xl font-semibold">Gość</h1>
          <Badge className="mt-2 bg-amber-500/15 text-amber-600 dark:text-amber-400">
            Konto lokalne
          </Badge>
          <Button
            className="mt-4"
            onClick={() => {
              router.push("/connect-account");
            }}
          >
            Połącz konto
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {loading ? (
        <CardContent className="flex flex-col items-center gap-6 py-10">
          <div className="flex justify-center">
            <span className="border-border size-10 animate-spin rounded-full border-4 border-t-transparent" />
          </div>
          <div className="bg-muted h-6 w-40 animate-pulse rounded" />
          <div className="bg-muted h-5 w-32 animate-pulse rounded" />
          <div className="bg-muted h-3 w-16 animate-pulse rounded" />
          <div className="bg-border h-px w-full" />
          <div className="bg-muted h-4 w-24 animate-pulse rounded" />
          <div className="bg-muted h-3 w-28 animate-pulse rounded" />
        </CardContent>
      ) : (
        <CardContent className="flex flex-col items-center space-y-4 text-center">
          <div className="relative">
            <Avatar className="size-24">
              <AvatarImage
                src={userData?.photo}
                alt={`Zdjęcie profilowe użytkownika ${userData?.full_name}`}
              />
              <AvatarFallback className="text-3xl" delayMs={600}>
                {getInitials(userData?.full_name ?? "")}
              </AvatarFallback>
            </Avatar>
            <button
              onClick={handleOpenDialog}
              className="bg-background hover:bg-accent absolute top-0 -right-2 inline-flex size-8 items-center justify-center rounded-full border shadow transition"
            >
              <PencilIcon className="size-4" />
            </button>
          </div>
          <h1 className="text-xl leading-tight font-semibold">
            {userData?.full_name}
          </h1>
          <h2 className="text-muted-foreground text-sm">
            {userData?.student_number}
          </h2>
          <div className="flex flex-wrap justify-center gap-2">
            {userData?.is_superuser === true ? (
              <Badge className="bg-destructive/15 text-destructive">
                Administrator
              </Badge>
            ) : null}
            {userData?.is_staff === true ? (
              <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400">
                Obsługa
              </Badge>
            ) : null}
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              Student
            </Badge>
          </div>
          <div className="bg-border h-px w-full" />
          <div className="w-full space-y-2 text-sm">
            <h5 className="text-muted-foreground font-medium">
              Prywatne dane:
            </h5>
            <ul className="space-y-1">
              <li>Id: {userData?.id}</li>
              <li>Email: {userData?.email}</li>
            </ul>
          </div>
          <div className="bg-border h-px w-full" />
          <div className="flex w-full items-center gap-4">
            <div>
              <Label className="text-sm font-medium" htmlFor="hide-profile">
                Ukryj profil
              </Label>
              <p className="text-muted-foreground text-xs">
                Nie będzie cię można znaleźć w wyszukiwarce po imieniu i
                nazwisku, nie będziesz wyświetlany w rankingach.
              </p>
            </div>
            <Switch
              id="hide-profile"
              checked={userData?.hide_profile ?? false}
              onCheckedChange={handleHideProfile}
              className="ml-auto"
            />
          </div>
          <div className="bg-border h-px w-full" />
          <p className="text-muted-foreground max-w-prose text-xs">
            Aby usunąć konto, pobrać lub zmienić dane, skontaktuj się z nami pod
            adresem:{" "}
            <a className="underline" href="mailto:kn.solvro@pwr.edu.pl">
              kn.solvro@pwr.edu.pl
            </a>
          </p>
        </CardContent>
      )}
      <Dialog
        open={showDialog}
        onOpenChange={(open) => {
          if (open) {
            setShowDialog(true);
          } else {
            handleCloseDialog();
          }
        }}
      >
        <DialogContent className="max-w-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Wybierz zdjęcie profilowe</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap justify-center gap-4">
            {avatarOptions.map((url, index) => (
              <Button
                key={`avatar-select-${index.toString()}`}
                variant="ghost"
                className={cn(
                  "size-20 rounded-full p-0 ring-2 transition-all hover:shadow-xl",
                  selectedPhoto === url
                    ? "ring-primary shadow-lg"
                    : "ring-transparent",
                )}
                onClick={() => {
                  setSelectedPhoto(url);
                }}
              >
                <Image
                  key={`avatar-option-${index.toString()}`}
                  src={url}
                  alt={`Avatar ${index.toString()}`}
                  className="size-20 rounded-full object-cover"
                  unoptimized
                  width={80}
                  height={80}
                />
              </Button>
            ))}
            {!avatarOptions.includes(selectedPhoto) && selectedPhoto ? (
              <Button
                variant="ghost"
                className="ring-primary size-20 rounded-full p-0 shadow-lg ring-2 transition-all hover:shadow-xl"
                onClick={() =>
                  toast(
                    "To zdjęcie nie jest już dostępne. Po zmianie na inne nie będzie możliwości powrotu.",
                  )
                }
              >
                <Image
                  src={selectedPhoto}
                  alt="Wybrane zdjęcie"
                  className="size-20 rounded-full object-cover"
                  unoptimized
                  width={96}
                  height={96}
                />
              </Button>
            ) : null}
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCloseDialog}>
              Anuluj
            </Button>
            <Button onClick={handleSavePhoto}>Zapisz</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
