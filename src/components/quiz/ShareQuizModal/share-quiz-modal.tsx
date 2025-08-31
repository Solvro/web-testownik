import { distance } from "fastest-levenshtein";
import { Link2Icon } from "lucide-react";
import React, { useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "react-toastify";

import Loader from "@/components/loader.tsx";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox.tsx";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label.tsx";
import { Popover, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

import AppContext from "../../../app-context.tsx";
import type { QuizMetadata } from "../types.ts";
import AccessLevelSelector from "./access-level-selector.tsx";
import AccessList from "./access-list.tsx";
import SearchResultsPopover from "./search-results-popover.tsx";
import type { Group, SharedQuiz, User } from "./types";
import { AccessLevel } from "./types";

interface ShareQuizModalProps {
  show: boolean;
  onHide: () => void;
  quiz: QuizMetadata;
  setQuiz?: (quiz: QuizMetadata) => void;
}

const ShareQuizModal: React.FC<ShareQuizModalProps> = ({
  show,
  onHide,
  quiz,
  setQuiz,
}) => {
  const appContext = useContext(AppContext);
  const navigate = useNavigate();

  const [accessLevel, setAccessLevel] = useState<AccessLevel>(
    AccessLevel.PRIVATE,
  );
  const [loading, setLoading] = useState(false);

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
  const [isMaintainerAnonymous, setIsMaintainerAnonymous] = useState(false);
  const [allowAnonymous, setAllowAnonymous] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<(User | Group)[]>([]);
  const [searchResultsLoading, setSearchResultsLoading] = useState(false);
  const [userGroups, setUserGroups] = useState<Group[]>([]);

  useEffect(() => {
    setAccessLevel(quiz.visibility);
    setIsMaintainerAnonymous(quiz.is_anonymous);
    setAllowAnonymous(quiz.allow_anonymous);
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchData = async () => {
    if (appContext.isGuest) {
      return;
    }
    setLoading(true);
    try {
      await Promise.all([fetchUserGroups(), fetchAccess()]);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAccess = async () => {
    if (appContext.isGuest) {
      setUsersWithAccess([]);
      setInitialUsersWithAccess([]);
      setGroupsWithAccess([]);
      setInitialGroupsWithAccess([]);
      return;
    }
    try {
      const response = await appContext.axiosInstance.get(
        `/shared-quizzes/?quiz=${quiz.id}`,
      );
      const sharedData = response.data;
      const foundUsers = sharedData.flatMap((sq: SharedQuiz) =>
        sq.user
          ? [
              {
                ...sq.user,
                shared_quiz_id: sq.id,
                allow_edit: sq.allow_edit,
              },
            ]
          : [],
      );
      const foundGroups = sharedData.flatMap((sq: SharedQuiz) =>
        sq.group
          ? [
              {
                ...sq.group,
                photo: `https://ui-avatars.com/api/?background=random&name=${sq.group.name.split(" ")[0]}+${sq.group.name.split(" ")[1] || ""}&size=128`,
                shared_quiz_id: sq.id,
                allow_edit: sq.allow_edit,
              },
            ]
          : [],
      );

      setUsersWithAccess(foundUsers);
      setInitialUsersWithAccess(foundUsers);
      setGroupsWithAccess(foundGroups);
      setInitialGroupsWithAccess(foundGroups);
    } catch {
      setUsersWithAccess([]);
      setInitialUsersWithAccess([]);
      setGroupsWithAccess([]);
      setInitialGroupsWithAccess([]);
    }
  };

  const fetchUserGroups = async () => {
    try {
      const response = await appContext.axiosInstance.get("/study-groups/");
      const data = response.data.map((group: Group) => ({
        ...group,
        photo: `https://ui-avatars.com/api/?background=random&name=${
          group.name.split(" ")[0]
        }+${group.name.split(" ")[1] || ""}&size=128`,
      }));
      setUserGroups(data);
    } catch {
      setUserGroups([]);
    }
  };

  const handleSearchInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSearch = useCallback(
    async (query: string) => {
      setSearchResultsLoading(true);
      try {
        // Fetch users
        const usersResponse = await appContext.axiosInstance.get<User[]>(
          `/users/?search=${encodeURIComponent(query)}`,
        );
        let data: (User | Group)[] = [...usersResponse.data];

        // Filter groups by the query
        const matchedGroups = userGroups.filter((g) =>
          g.name.toLowerCase().includes(query.toLowerCase()),
        );
        data = [...data, ...matchedGroups];

        // If query is exactly 6 digits, prioritize matching student_number
        let userByIndex: User | undefined;
        if (query.length === 6 && !isNaN(Number.parseInt(query))) {
          userByIndex = data.find(
            (object) =>
              "student_number" in object && object.student_number === query,
          ) as User;
          if (userByIndex) {
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

        if (userByIndex) {
          data.unshift(userByIndex);
        }

        setSearchResults(data);
      } catch {
        setSearchResults([]);
      } finally {
        setSearchResultsLoading(false);
      }
    },
    [userGroups, appContext.axiosInstance],
  );

  const handleAddEntity = (entity: User | Group) => {
    // If it's a user
    if ("full_name" in entity) {
      // Prevent duplicates
      if (
        !usersWithAccess.find((u) => u.id === entity.id) &&
        entity.id !== quiz.maintainer?.id
      ) {
        setUsersWithAccess((previous) => [
          ...previous,
          { ...entity, allow_edit: false },
        ]);
      }
    } else {
      // It's a group
      if (!groupsWithAccess.find((g) => g.id === entity.id)) {
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
      const quizResponse = await appContext.axiosInstance.patch(
        `/quizzes/${quiz.id}/`,
        {
          visibility: accessLevel,
          allow_anonymous:
            allowAnonymous && accessLevel >= AccessLevel.UNLISTED,
          is_anonymous: isMaintainerAnonymous,
        },
      );

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
        return initial && initial.allow_edit !== u.allow_edit;
      });
      const changedGroups = groupsWithAccess.filter((g) => {
        const initial = initialGroupsWithAccess.find((g2) => g2.id === g.id);
        return initial && initial.allow_edit !== g.allow_edit;
      });

      for (const rUser of removedUsers) {
        await appContext.axiosInstance.delete(
          `/shared-quizzes/${rUser.shared_quiz_id}/`,
        );
      }

      for (const rGroup of removedGroups) {
        await appContext.axiosInstance.delete(
          `/shared-quizzes/${rGroup.shared_quiz_id}/`,
        );
      }

      for (const aUser of addedUsers) {
        await appContext.axiosInstance.post(`/shared-quizzes/`, {
          quiz_id: quiz.id,
          user_id: aUser.id,
          allow_edit: aUser.allow_edit || false,
        });
      }

      for (const aGroup of addedGroups) {
        await appContext.axiosInstance.post(`/shared-quizzes/`, {
          quiz_id: quiz.id,
          study_group_id: aGroup.id,
          allow_edit: aGroup.allow_edit || false,
        });
      }

      // Update existing users/groups with changed allow_edit status
      for (const cUser of changedUsers) {
        await appContext.axiosInstance.patch(
          `/shared-quizzes/${cUser.shared_quiz_id}/`,
          {
            allow_edit: cUser.allow_edit,
          },
        );
      }

      for (const cGroup of changedGroups) {
        await appContext.axiosInstance.patch(
          `/shared-quizzes/${cGroup.shared_quiz_id}/`,
          {
            allow_edit: cGroup.allow_edit,
          },
        );
      }

      // 8) Re-fetch everything or just update local “initial” states to reflect new changes
      setInitialUsersWithAccess(usersWithAccess);
      setInitialGroupsWithAccess(groupsWithAccess);

      if (setQuiz) {
        setQuiz(quizResponse.data);
      }

      onHide();
    } catch (error) {
      console.error("Failed to save quiz settings:", error);
    }
  };

  return (
    <Dialog
      open={show}
      onOpenChange={(open) => {
        if (!open) {
          onHide();
        }
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Udostępnij "{quiz.title}"</DialogTitle>
        </DialogHeader>
        {appContext.isGuest ? (
          <div className="rounded-md border border-yellow-500/40 bg-yellow-500/10 p-4 text-center text-sm">
            <p className="mb-2 font-medium">
              Musisz być zalogowany, aby móc udostępniać quizy.
            </p>
            <Button
              variant="outline"
              onClick={async () => navigate("/connect-account")}
            >
              Połącz konto
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <Popover open={show ? searchQuery.length > 0 : null} modal={true}>
              <PopoverTrigger asChild>
                <div className="relative w-full">
                  <Input
                    placeholder="Wpisz imię/nazwisko, grupę lub numer indeksu..."
                    value={searchQuery}
                    onChange={handleSearchInput}
                    onKeyUp={() => {
                      if (searchQuery.length >= 3) {
                        handleSearch(searchQuery);
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
                    allowAnonymous ? accessLevel >= AccessLevel.UNLISTED : null
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
            {accessLevel == AccessLevel.PRIVATE &&
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
            onClick={() => {
              navigator.clipboard.writeText(
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
            onClick={() => {
              navigator.clipboard.writeText(
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
};

export default ShareQuizModal;
