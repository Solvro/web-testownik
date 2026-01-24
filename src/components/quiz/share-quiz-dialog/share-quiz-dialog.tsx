import { useQuery } from "@tanstack/react-query";
import { distance } from "fastest-levenshtein";
import { Link2Icon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import { toast } from "sonner";

import { AppContext } from "@/app-context";
import { Loader } from "@/components/loader";
import { AccessLevelSelector } from "@/components/quiz/share-quiz-dialog/access-level-selector";
import { AccessList } from "@/components/quiz/share-quiz-dialog/access-list";
import { SearchResultsPopover } from "@/components/quiz/share-quiz-dialog/search-results-popover";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { QuizMetadata, SharedQuiz } from "@/types/quiz";
import { AccessLevel } from "@/types/quiz";
import type { Group, User } from "@/types/user";

interface ShareQuizDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  quiz: QuizMetadata;
  setQuiz?: (quiz: QuizMetadata) => void;
}

export function ShareQuizDialog({
  open,
  onOpenChange,
  quiz,
  setQuiz,
}: ShareQuizDialogProps) {
  const appContext = useContext(AppContext);
  const router = useRouter();

  const [accessLevel, setAccessLevel] = useState<AccessLevel>(quiz.visibility);

  const [initialUsersWithAccess, setInitialUsersWithAccess] = useState<
    (User & { shared_quiz_id?: string; allow_edit: boolean })[]
  >([]);
  const [initialGroupsWithAccess, setInitialGroupsWithAccess] = useState<
    (Group & { shared_quiz_id?: string; allow_edit: boolean })[]
  >([]);
  const [usersWithAccess, setUsersWithAccess] = useState<
    (User & { shared_quiz_id?: string; allow_edit: boolean })[]
  >([]);
  const [groupsWithAccess, setGroupsWithAccess] = useState<
    (Group & { shared_quiz_id?: string; allow_edit: boolean })[]
  >([]);
  const [isMaintainerAnonymous, setIsMaintainerAnonymous] = useState(
    quiz.is_anonymous,
  );
  const [allowAnonymous, setAllowAnonymous] = useState(quiz.allow_anonymous);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<(User | Group)[]>([]);
  const [searchResultsLoading, setSearchResultsLoading] = useState(false);

  const { data: userGroups, isLoading: isUserGroupsLoading } = useQuery({
    queryKey: ["study-groups"],
    queryFn: async () => {
      const groups = await appContext.services.quiz.getStudyGroups();
      return groups.map((group) => ({
        ...group,
        photo: `https://ui-avatars.com/api/?background=random&name=${
          group.name.split(" ")[0]
        }+${group.name.split(" ")[1] || ""}&size=128`,
      }));
    },
    enabled: open && !appContext.isGuest,
    initialData: [],
  });

  const { data: sharedData, isLoading: isSharedDataLoading } = useQuery({
    queryKey: ["shared-quiz", quiz.id],
    queryFn: async () =>
      await appContext.services.quiz.getSharedQuizzesForQuiz(quiz.id),
    enabled: open && !appContext.isGuest,
    staleTime: 0,
  });

  const loading = isSharedDataLoading || isUserGroupsLoading;

  useEffect(() => {
    if (sharedData != null) {
      const foundUsers = sharedData.flatMap((sq: SharedQuiz) =>
        sq.user == null
          ? []
          : [
              {
                ...sq.user,
                shared_quiz_id: sq.id,
                allow_edit: sq.allow_edit,
              },
            ],
      );
      const foundGroups = sharedData.flatMap((sq: SharedQuiz) =>
        sq.group == null
          ? []
          : [
              {
                ...sq.group,
                photo: `https://ui-avatars.com/api/?background=random&name=${
                  sq.group.name.split(" ")[0]
                }+${sq.group.name.split(" ")[1] || ""}&size=128`,
                shared_quiz_id: sq.id,
                allow_edit: sq.allow_edit,
              },
            ],
      );

      setUsersWithAccess(foundUsers);
      setInitialUsersWithAccess(foundUsers);
      setGroupsWithAccess(foundGroups);
      setInitialGroupsWithAccess(foundGroups);
    }
  }, [sharedData]);

  const handleSearchInput = (event_: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(event_.target.value);
  };

  const handleSearch = async (query: string) => {
    setSearchResultsLoading(true);
    try {
      // Fetch users
      const users = await appContext.services.quiz.searchUsers(query);
      let data: (User | Group)[] = [...users];

      // Filter groups by the query
      const matchedGroups = userGroups.filter((g) =>
        g.name.toLowerCase().includes(query.toLowerCase()),
      );
      data = [...data, ...matchedGroups];

      // If query is exactly 6 digits, prioritize matching student_number
      let userByIndex: User | undefined;
      if (query.length === 6 && !Number.isNaN(Number.parseInt(query))) {
        userByIndex = data.find(
          (object) =>
            "student_number" in object && object.student_number === query,
        ) as User | undefined;
        if (userByIndex != null) {
          data = data.filter((item) => item !== userByIndex);
        }
      }

      // Sort results by "distance" to the query
      data.sort((a, b) => {
        const aIsGroup = "name" in a;
        const bIsGroup = "name" in b;

        if (aIsGroup && bIsGroup) {
          // Both groups
          const aGroup = a;
          const bGroup = b;
          if (aGroup.term.is_current && !bGroup.term.is_current) {
            return -1;
          }
          if (!aGroup.term.is_current && bGroup.term.is_current) {
            return 1;
          }
          return distance(aGroup.name, query) - distance(bGroup.name, query);
        } else if (aIsGroup) {
          // a is Group, b is User
          return (
            distance(a.name, query) - distance((b as User).full_name, query)
          );
        } else if (bIsGroup) {
          // a is User, b is Group
          return distance(a.full_name, query) - distance(b.name, query);
        } else {
          // both users
          return distance(a.full_name, query) - distance(b.full_name, query);
        }
      });

      if (userByIndex != null) {
        data.unshift(userByIndex);
      }

      setSearchResults(data);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchResultsLoading(false);
    }
  };

  const handleAddEntity = (entity: User | Group) => {
    // If it's a user
    if ("full_name" in entity) {
      // Prevent duplicates
      if (
        !usersWithAccess.some((u) => u.id === entity.id) &&
        entity.id !== quiz.maintainer?.id
      ) {
        setUsersWithAccess((previous) => [
          ...previous,
          { ...entity, allow_edit: false },
        ]);
      }
    } else {
      // It's a group
      if (!groupsWithAccess.some((g) => g.id === entity.id)) {
        setGroupsWithAccess((previous) => [
          ...previous,
          { ...entity, allow_edit: false },
        ]);
      }
    }
    setSearchQuery("");
    setSearchResults([]);
  };

  const handleRemoveUserAccess = (user: User) => {
    setUsersWithAccess((previous) => previous.filter((u) => u.id !== user.id));
  };

  const handleRemoveGroupAccess = (group: Group) => {
    setGroupsWithAccess((previous) =>
      previous.filter((g) => g.id !== group.id),
    );
  };

  const handleToggleUserEdit = (
    user: User & { shared_quiz_id?: string; allow_edit: boolean },
  ) => {
    setUsersWithAccess((previous) =>
      previous.map((u) =>
        u.id === user.id ? { ...u, allow_edit: !u.allow_edit } : u,
      ),
    );
  };

  const handleToggleGroupEdit = (
    group: Group & { shared_quiz_id?: string; allow_edit: boolean },
  ) => {
    setGroupsWithAccess((previous) =>
      previous.map((g) =>
        g.id === group.id ? { ...g, allow_edit: !g.allow_edit } : g,
      ),
    );
  };

  // -------------- Save Handler -------------- //
  const handleSave = async () => {
    try {
      // 1) Update quiz metadata (visibility, allow_anonymous, is_anonymous)
      const quizResponse = await appContext.services.quiz.updateQuiz(quiz.id, {
        visibility: accessLevel,
        allow_anonymous: allowAnonymous && accessLevel >= AccessLevel.UNLISTED,
        is_anonymous: isMaintainerAnonymous,
      });

      const removedUsers = initialUsersWithAccess.filter(
        (u) => !usersWithAccess.some((u2) => u2.id === u.id),
      );
      const addedUsers = usersWithAccess.filter(
        (u) => !initialUsersWithAccess.some((u2) => u2.id === u.id),
      );

      const removedGroups = initialGroupsWithAccess.filter(
        (g) => !groupsWithAccess.some((g2) => g2.id === g.id),
      );
      const addedGroups = groupsWithAccess.filter(
        (g) => !initialGroupsWithAccess.some((g2) => g2.id === g.id),
      );

      // Find existing users/groups with changed allow_edit status
      const changedUsers = usersWithAccess.filter((u) => {
        const initial = initialUsersWithAccess.find((u2) => u2.id === u.id);
        return initial != null && initial.allow_edit !== u.allow_edit;
      });
      const changedGroups = groupsWithAccess.filter((g) => {
        const initial = initialGroupsWithAccess.find((g2) => g2.id === g.id);
        return initial != null && initial.allow_edit !== g.allow_edit;
      });

      for (const rUser of removedUsers) {
        if (rUser.shared_quiz_id == null) {
          continue;
        }
        await appContext.services.quiz.deleteSharedQuiz(rUser.shared_quiz_id);
      }

      for (const rGroup of removedGroups) {
        if (rGroup.shared_quiz_id == null) {
          continue;
        }
        await appContext.services.quiz.deleteSharedQuiz(rGroup.shared_quiz_id);
      }

      for (const aUser of addedUsers) {
        await appContext.services.quiz.shareQuizWithUser(
          quiz.id,
          aUser.id,
          aUser.allow_edit || false,
        );
      }

      for (const aGroup of addedGroups) {
        await appContext.services.quiz.shareQuizWithGroup(
          quiz.id,
          aGroup.id,
          aGroup.allow_edit || false,
        );
      }

      // Update existing users/groups with changed allow_edit status
      for (const cUser of changedUsers) {
        if (cUser.shared_quiz_id == null) {
          continue;
        }
        await appContext.services.quiz.updateSharedQuiz(
          cUser.shared_quiz_id,
          cUser.allow_edit,
        );
      }

      for (const cGroup of changedGroups) {
        if (cGroup.shared_quiz_id == null) {
          continue;
        }
        await appContext.services.quiz.updateSharedQuiz(
          cGroup.shared_quiz_id,
          cGroup.allow_edit,
        );
      }

      // 8) Re-fetch everything or just update local “initial” states to reflect new changes
      setInitialUsersWithAccess(usersWithAccess);
      setInitialGroupsWithAccess(groupsWithAccess);

      if (setQuiz != null) {
        setQuiz(quizResponse);
      }

      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save quiz settings:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Udostępnij &quot;{quiz.title}&quot;</DialogTitle>
        </DialogHeader>
        {appContext.isGuest ? (
          <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-4 text-center text-sm">
            <p className="mb-2 font-medium">
              Musisz być zalogowany, aby móc udostępniać quizy.
            </p>
            <Button
              variant="outline"
              onClick={() => {
                router.push("/connect-account");
              }}
            >
              Połącz konto
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Popover
              open={open ? searchQuery.length > 0 : undefined}
              modal={true}
            >
              <PopoverTrigger asChild>
                <div className="relative w-full">
                  <Input
                    placeholder="Wpisz imię/nazwisko, grupę lub numer indeksu..."
                    value={searchQuery}
                    onChange={handleSearchInput}
                    onKeyUp={() => {
                      if (searchQuery.length >= 3) {
                        void handleSearch(searchQuery);
                      } else {
                        setSearchResults([]);
                      }
                    }}
                  />
                </div>
              </PopoverTrigger>
              {searchQuery.length > 0 && (
                <SearchResultsPopover
                  searchResults={searchResults}
                  searchResultsLoading={searchResultsLoading}
                  handleAddEntity={handleAddEntity}
                  searchQuery={searchQuery}
                />
              )}
            </Popover>
            <div className="space-y-2">
              <h5 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                Dostęp mają:
              </h5>
              {loading ? (
                <div className="flex w-full justify-center py-4">
                  <Loader size={10} />
                </div>
              ) : (
                <AccessList
                  quizMetadata={quiz}
                  usersWithAccess={usersWithAccess}
                  groupsWithAccess={groupsWithAccess}
                  isMaintainerAnonymous={isMaintainerAnonymous}
                  setIsMaintainerAnonymous={setIsMaintainerAnonymous}
                  handleRemoveUserAccess={handleRemoveUserAccess}
                  handleRemoveGroupAccess={handleRemoveGroupAccess}
                  handleToggleUserEdit={handleToggleUserEdit}
                  handleToggleGroupEdit={handleToggleGroupEdit}
                />
              )}
            </div>
            <div className="space-y-2">
              <h5 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
                Poziom dostępu:
              </h5>
              <AccessLevelSelector
                value={accessLevel}
                onChange={setAccessLevel}
              />
              <div className="flex items-center gap-3">
                <Checkbox
                  id="allow-anonymous"
                  checked={
                    allowAnonymous ? accessLevel >= AccessLevel.UNLISTED : false
                  }
                  onCheckedChange={(checked) => {
                    setAllowAnonymous(Boolean(checked));
                  }}
                  disabled={accessLevel < AccessLevel.UNLISTED}
                />
                <Label htmlFor="allow-anonymous">
                  Pozwól na dostęp dla niezalogowanych/gości
                </Label>
              </div>
            </div>
            {accessLevel === AccessLevel.PRIVATE &&
              (usersWithAccess.length > 0 || groupsWithAccess.length > 0) && (
                <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-3 text-xs text-yellow-700 dark:text-yellow-400">
                  Ustawiono dostęp prywatny, ale dodano użytkowników/grupy. Quiz
                  nie będzie dla nich dostępny.
                </div>
              )}
          </div>
        )}
        <DialogFooter
          className={cn(
            "sm:flex-row sm:justify-between",
            appContext.isGuest && "hidden",
          )}
        >
          <Button
            variant="outline"
            onClick={async () => {
              await navigator.clipboard.writeText(
                `${window.location.origin}/quiz/${quiz.id}`,
              );
              toast.success("Skopiowano link do quizu");
            }}
            className="hidden sm:inline-flex"
          >
            <Link2Icon className="size-4" />
            Kopiuj link
          </Button>
          <div className="flex flex-wrap-reverse gap-2">
            <DialogClose asChild>
              <Button variant="outline" className="w-full sm:w-auto">
                Anuluj
              </Button>
            </DialogClose>
            <Button className="w-full sm:w-auto" onClick={handleSave}>
              Zapisz
            </Button>
          </div>
          <Button
            variant="link"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(
                `${window.location.origin}/quiz/${quiz.id}`,
              );
              toast.success("Skopiowano link do quizu");
            }}
            className="sm:hidden"
          >
            <Link2Icon className="size-4" />
            Kopiuj link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
