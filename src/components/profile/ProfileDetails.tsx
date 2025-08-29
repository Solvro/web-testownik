import React, { useContext, useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AppContext from "../../AppContext.tsx";
import { toast } from "react-toastify";
import { useNavigate } from "react-router";
import { Badge } from "@/components/ui/badge.tsx";
import { Switch } from "@/components/ui/switch.tsx";
import { Label } from "@/components/ui/label.tsx";
import { IdCardLanyardIcon, PencilIcon } from "lucide-react";

interface UserData {
  id: string;
  full_name: string;
  student_number: string;
  email: string;
  photo_url: string;
  overriden_photo_url: string;
  photo: string;
  is_superuser: boolean;
  is_staff: boolean;
  hide_profile: boolean;
}

interface ProfileDetailsProps {
  userData: UserData | null;
  loading: boolean;
  setUserData: (data: UserData) => void;
}

const ProfileDetails: React.FC<ProfileDetailsProps> = ({
  userData,
  loading,
  setUserData,
}) => {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(userData?.photo || "");

  const handleOpenModal = () => setShowModal(true);
  const handleCloseModal = () => {
    setSelectedPhoto(userData?.photo || "");
    setShowModal(false);
  };

  const handleSavePhoto = () => {
    handleCloseModal();
    appContext.axiosInstance
      .patch("/user/", {
        overriden_photo_url:
          selectedPhoto !== userData?.photo_url ? selectedPhoto : null,
      })
      .then(() => {
        localStorage.setItem("profile_picture", selectedPhoto);
        document
          .getElementById("profile-pic")
          ?.setAttribute("src", selectedPhoto);
        if (userData) setUserData({ ...userData, photo: selectedPhoto });
      })
      .catch((err) => {
        console.error("Error saving photo:", err);
        toast.error("Wystąpił błąd podczas zapisywania zdjęcia profilowego.");
      });
  };

  const handleHideProfile = (hide: boolean) => {
    appContext.axiosInstance
      .patch("/user/", { hide_profile: hide })
      .then(() => {
        if (userData) setUserData({ ...userData, hide_profile: hide });
      })
      .catch((err) => {
        console.error("Error saving photo:", err);
        toast.error("Wystąpił błąd podczas zapisywania zdjęcia profilowego.");
      });
  };

  useEffect(() => {
    setSelectedPhoto(userData?.photo || "");
  }, [userData?.photo]);

  const avatarOptions = [
    userData?.photo_url,
    encodeURI(
      `https://api.dicebear.com/9.x/adventurer/svg?seed=${userData?.full_name}`,
    ),
    encodeURI(
      `https://api.dicebear.com/9.x/adventurer/svg?seed=${userData?.full_name} 2`,
    ),
    encodeURI(
      `https://api.dicebear.com/9.x/adventurer/svg?seed=${userData?.full_name} 3`,
    ),
    encodeURI(
      `https://api.dicebear.com/9.x/dylan/svg?seed=${userData?.full_name}`,
    ),
    encodeURI(
      `https://api.dicebear.com/9.x/micah/svg?seed=${userData?.full_name}`,
    ),
    encodeURI(
      `https://api.dicebear.com/9.x/micah/svg?seed=${userData?.full_name} 2`,
    ),
    encodeURI(
      `https://api.dicebear.com/9.x/shapes/svg?seed=${userData?.full_name}`,
    ),
    encodeURI(
      `https://api.dicebear.com/9.x/initials/svg?seed=${userData?.full_name}`,
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
          <Button className="mt-4" onClick={() => navigate("/connect-account")}>
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
            <img
              src={userData?.photo}
              alt="Profilowe"
              className="h-24 w-24 rounded-full object-cover"
            />
            <button
              onClick={handleOpenModal}
              className="bg-background hover:bg-accent absolute top-0 -right-2 inline-flex h-8 w-8 items-center justify-center rounded-full border shadow transition"
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
            {userData?.is_superuser && (
              <Badge className="bg-destructive/15 text-destructive">
                Administrator
              </Badge>
            )}
            {userData?.is_staff && (
              <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400">
                Obsługa
              </Badge>
            )}
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
              checked={userData?.hide_profile || false}
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
        open={showModal}
        onOpenChange={(open) => {
          if (!open) handleCloseModal();
          else setShowModal(true);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Wybierz zdjęcie profilowe</DialogTitle>
          </DialogHeader>
          <div className="flex flex-wrap justify-center gap-4">
            {avatarOptions.map((url, index) => (
              <img
                key={index}
                src={url}
                alt={`Avatar ${index}`}
                className={`h-20 w-20 cursor-pointer rounded-full object-cover ring-2 ${selectedPhoto === url ? "ring-primary shadow-lg" : "ring-transparent"}`}
                onClick={() => setSelectedPhoto(url || "")}
              />
            ))}
            {!avatarOptions.includes(selectedPhoto) && selectedPhoto && (
              <img
                src={selectedPhoto}
                alt="Avatar"
                className="ring-primary h-20 w-20 cursor-pointer rounded-full object-cover shadow-lg ring-2"
                onClick={() =>
                  toast(
                    "To zdjęcie nie jest już dostępne. Po zmianie na inne nie będzie możliwości powrotu.",
                  )
                }
              />
            )}
          </div>
          <DialogFooter className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleCloseModal}>
              Anuluj
            </Button>
            <Button onClick={handleSavePhoto}>Zapisz</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default ProfileDetails;
