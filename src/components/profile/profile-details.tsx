import { IdCardLanyardIcon, PencilIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { AccountLevelBadge } from "@/components/account-level-badge";
import { AccountTypeBadge } from "@/components/account-type-badge";
import { ProfilePhotoDialog } from "@/components/profile/profile-photo-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useUpdateUserProfile } from "@/hooks/use-user-profile";
import { getAccountLevelProfileAvatarClassName } from "@/lib/account-level";
import { cn, getInitials } from "@/lib/utils";
import { ACCOUNT_LEVEL, ACCOUNT_TYPE } from "@/types/user";
import type { UserData } from "@/types/user";

interface ProfileDetailsProps {
  userData: UserData | null;
  loading: boolean;
}

export function ProfileDetails({ userData, loading }: ProfileDetailsProps) {
  const router = useRouter();
  const updateUserProfile = useUpdateUserProfile();
  const [showDialog, setShowDialog] = useState(false);
  const handleHideProfile = (hide: boolean) => {
    updateUserProfile.mutate(
      { hide_profile: hide },
      {
        onError: (error: unknown) => {
          console.error("Error saving profile visibility:", error);
          toast.error("Wystąpił błąd podczas zapisywania ustawień profilu.");
        },
      },
    );
  };

  if (userData?.account_type === ACCOUNT_TYPE.GUEST) {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="flex flex-col items-center py-8 text-center">
            <IdCardLanyardIcon className="text-muted-foreground size-24" />
            <h1 className="mt-4 text-xl font-semibold">Gość</h1>
            <AccountTypeBadge
              accountType={ACCOUNT_TYPE.GUEST}
              className="mt-2"
            />
            <Button
              className="mt-4"
              onClick={() => {
                router.push("/login");
              }}
            >
              Zaloguj się
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Card>
        {loading ? (
          <CardContent
            className="flex flex-col items-center space-y-4 text-center"
            role="status"
            aria-label="Ładowanie profilu"
          >
            <Skeleton className="size-24 rounded-full" />
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-5 w-24" />
            <div className="flex justify-center gap-2">
              <Skeleton className="h-5 w-20 rounded-md" />
              <Skeleton className="h-5 w-16 rounded-md" />
            </div>
            <div className="bg-border h-px w-full" />
            <div className="w-full space-y-2 text-sm">
              <h5 className="text-muted-foreground font-medium">
                Prywatne dane:
              </h5>
              <div className="space-y-2">
                <Skeleton className="mx-auto h-5 w-28" />
                <Skeleton className="mx-auto h-5 w-44 max-w-full" />
              </div>
            </div>
            <div className="bg-border h-px w-full" />
            <div className="flex w-full items-center gap-4 text-left">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Ukryj profil</p>
                <p className="text-muted-foreground text-xs">
                  Nie będzie cię można znaleźć w wyszukiwarce po imieniu i
                  nazwisku, nie będziesz wyświetlany w rankingach.
                </p>
              </div>
              <Switch disabled className="ml-auto" />
            </div>
            <div className="bg-border h-px w-full" />
            <p className="text-muted-foreground max-w-prose text-xs">
              Aby usunąć konto, pobrać lub zmienić dane, skontaktuj się z nami
              pod adresem:{" "}
              <a className="underline" href="mailto:kn.solvro@pwr.edu.pl">
                kn.solvro@pwr.edu.pl
              </a>
            </p>
          </CardContent>
        ) : (
          <CardContent className="flex flex-col items-center space-y-4 text-center">
            <div className="relative">
              <Avatar
                className={cn(
                  "size-24",
                  getAccountLevelProfileAvatarClassName(
                    userData?.account_level,
                  ),
                )}
              >
                <AvatarImage
                  src={userData?.photo ?? undefined}
                  alt={`Zdjęcie profilowe użytkownika ${userData?.full_name ?? ""}`}
                />
                <AvatarFallback className="text-3xl" delay={600}>
                  {getInitials(userData?.full_name ?? "")}
                </AvatarFallback>
              </Avatar>
              <button
                aria-label="Zmień zdjęcie profilowe"
                onClick={() => {
                  setShowDialog(true);
                }}
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
              <AccountTypeBadge
                accountType={userData?.account_type ?? ACCOUNT_TYPE.GUEST}
              />
              <AccountLevelBadge
                accountLevel={userData?.account_level ?? ACCOUNT_LEVEL.BASIC}
              />
            </div>
            <div className="bg-border h-px w-full" />
            <div className="w-full space-y-2 text-sm">
              <h5 className="text-muted-foreground font-medium">
                Prywatne dane:
              </h5>
              <ul className="space-y-1">
                <li>Id: {userData?.id}</li>
                <li>Email: {userData?.email ?? "—"}</li>
              </ul>
            </div>
            <div className="bg-border h-px w-full" />
            <div className="flex w-full items-center gap-4">
              <div>
                <Label className="text-sm font-medium" htmlFor="hide-profile">
                  Ukryj profil
                </Label>
                <p className="text-muted-foreground text-left text-xs">
                  Nie będzie cię można znaleźć w wyszukiwarce po imieniu i
                  nazwisku, nie będziesz wyświetlany w rankingach.
                </p>
              </div>
              <Switch
                id="hide-profile"
                checked={userData?.hide_profile ?? false}
                onCheckedChange={handleHideProfile}
                disabled={updateUserProfile.isPending}
                className="ml-auto"
              />
            </div>
            <div className="bg-border h-px w-full" />
            <p className="text-muted-foreground max-w-prose text-xs">
              Aby usunąć konto, pobrać lub zmienić dane, skontaktuj się z nami
              pod adresem:{" "}
              <a className="underline" href="mailto:kn.solvro@pwr.edu.pl">
                kn.solvro@pwr.edu.pl
              </a>
            </p>
          </CardContent>
        )}
      </Card>
      {showDialog && userData !== null ? (
        <ProfilePhotoDialog
          userData={userData}
          onClose={() => {
            setShowDialog(false);
          }}
        />
      ) : null}
    </div>
  );
}
