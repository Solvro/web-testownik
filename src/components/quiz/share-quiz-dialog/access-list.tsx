import {
  CrownIcon,
  EyeIcon,
  HatGlassesIcon,
  PencilIcon,
  TrashIcon,
  UserIcon,
} from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { useState } from "react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Toggle } from "@/components/ui/toggle";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn, getInitials } from "@/lib/utils";
import type { QuizMetadata } from "@/types/quiz";
import type { Group, User } from "@/types/user";

interface AccessListProps {
  quizMetadata: QuizMetadata;
  usersWithAccess: (User & { shared_quiz_id?: string; allow_edit: boolean })[];
  groupsWithAccess: (Group & {
    shared_quiz_id?: string;
    allow_edit: boolean;
  })[];
  isMaintainerAnonymous: boolean;
  setIsMaintainerAnonymous: Dispatch<SetStateAction<boolean>>;
  handleRemoveUserAccess: (user: User) => void;
  handleRemoveGroupAccess: (group: Group) => void;
  handleToggleUserEdit: (
    user: User & { shared_quiz_id?: string; allow_edit: boolean },
  ) => void;
  handleToggleGroupEdit: (
    group: Group & { shared_quiz_id?: string; allow_edit: boolean },
  ) => void;
}

export function AccessList({
  quizMetadata,
  usersWithAccess,
  groupsWithAccess,
  isMaintainerAnonymous,
  setIsMaintainerAnonymous,
  handleRemoveUserAccess,
  handleRemoveGroupAccess,
  handleToggleUserEdit,
  handleToggleGroupEdit,
}: AccessListProps) {
  const [hoverTooltipGroupId, setHoverTooltipGroupId] = useState<string | null>(
    null,
  );
  const [hoverTooltipOwner, setHoverTooltipOwner] = useState<boolean>(false);

  function UserTooltip(
    user: User & { shared_quiz_id?: string; allow_edit: boolean },
  ) {
    const [open, setOpen] = useState(false);
    const [allowEdit, setAllowEdit] = useState(user.allow_edit);

    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip open={open} onOpenChange={setOpen}>
          <TooltipTrigger asChild>
            <Toggle
              pressed={user.allow_edit}
              onPressedChange={() => {
                setOpen(true);
                setAllowEdit(!allowEdit);
                handleToggleUserEdit(user);
              }}
              size="sm"
              className={cn(
                "size-8 rounded-full p-0 transition-colors",
                "data-[state=off]:bg-muted data-[state=on]:bg-green-500/15",
              )}
            >
              {allowEdit ? (
                <PencilIcon className="size-5 text-green-600" />
              ) : (
                <EyeIcon className="text-muted-foreground size-5" />
              )}
            </Toggle>
          </TooltipTrigger>
          <TooltipContent side="top" align="center">
            {allowEdit ? "Wyłącz edycję" : "Zezwól na edycję"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <ScrollArea className="w-full [&_[data-slot=scroll-area-viewport]]:max-h-64">
      <div className="flex flex-col gap-2">
        {quizMetadata.maintainer != null && (
          <div
            className="flex w-full items-center gap-1"
            key={`maintainer-${quizMetadata.maintainer.id}`}
          >
            <div
              className={cn(
                "bg-muted/40 flex w-full items-center justify-between gap-2 rounded-md border p-2",
              )}
            >
              <div className="flex items-center gap-2">
                <Avatar>
                  <AvatarImage src={quizMetadata.maintainer.photo} />
                  <AvatarFallback delayMs={600}>
                    {getInitials(quizMetadata.maintainer.full_name)}
                  </AvatarFallback>
                </Avatar>
                <p className="m-0 text-sm font-medium">
                  {quizMetadata.maintainer.full_name}
                </p>
              </div>
              <div
                className="flex items-center gap-2"
                onMouseEnter={() => {
                  setHoverTooltipOwner(true);
                }}
                onMouseLeave={() => {
                  setHoverTooltipOwner(false);
                }}
              >
                <Tooltip open={hoverTooltipOwner}>
                  <TooltipTrigger asChild>
                    <Toggle
                      pressed={isMaintainerAnonymous}
                      onPressedChange={setIsMaintainerAnonymous}
                      size="sm"
                      className={cn(
                        "size-8 rounded-full p-0 transition-colors",
                        "data-[state=off]:bg-sky-500/15 data-[state=on]:bg-red-500/15",
                      )}
                    >
                      {isMaintainerAnonymous ? (
                        <HatGlassesIcon className="size-5 text-red-500" />
                      ) : (
                        <UserIcon className="size-5 text-sky-500" />
                      )}
                    </Toggle>
                  </TooltipTrigger>

                  <TooltipContent>
                    <p>
                      {isMaintainerAnonymous
                        ? "Ujawnij właściciela"
                        : "Ukryj właściciela"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="pointer-events-none h-full"
            >
              <CrownIcon className="size-5 text-amber-500" />
            </Button>
          </div>
        )}

        {/* Users with access */}
        {usersWithAccess.map((user) => (
          <div className="flex w-full items-center gap-1" key={user.id}>
            <div className="bg-muted/40 flex w-full items-center justify-between gap-2 rounded-md border p-2">
              <div className="flex items-center gap-2">
                <Avatar>
                  <AvatarImage src={user.photo} />
                  <AvatarFallback delayMs={600}>
                    {getInitials(user.full_name)}
                  </AvatarFallback>
                </Avatar>
                <p className="m-0 text-sm font-medium">{user.full_name}</p>
              </div>

              <UserTooltip
                id={user.id}
                full_name={user.full_name}
                photo={user.photo}
                student_number={user.student_number}
                allow_edit={user.allow_edit}
              />

              {/*<div*/}
              {/*  className="flex items-center gap-2"*/}
              {/*  onMouseEnter={() => {*/}
              {/*    setHoverTooltipUserId(user.id);*/}
              {/*  }}*/}
              {/*  onMouseLeave={() => {*/}
              {/*    setHoverTooltipUserId(null);*/}
              {/*  }}*/}
              {/*>*/}
              {/*  <Tooltip open={hoverTooltipUserId === user.id}>*/}
              {/*    <TooltipTrigger asChild>*/}
              {/*      <Toggle*/}
              {/*        pressed={user.allow_edit}*/}
              {/*        onPressedChange={() => {*/}
              {/*          handleToggleUserEdit(user);*/}
              {/*        }}*/}
              {/*        size="sm"*/}
              {/*        className={cn(*/}
              {/*          "size-8 rounded-full p-0 transition-colors",*/}
              {/*          "data-[state=off]:bg-muted data-[state=on]:bg-green-500/15",*/}
              {/*        )}*/}
              {/*      >*/}
              {/*        {user.allow_edit ? (*/}
              {/*          <PencilIcon className="size-5 text-green-600" />*/}
              {/*        ) : (*/}
              {/*          <EyeIcon className="text-muted-foreground size-5" />*/}
              {/*        )}*/}
              {/*      </Toggle>*/}
              {/*    </TooltipTrigger>*/}

              {/*    <TooltipContent>*/}
              {/*      <p>*/}
              {/*        {user.allow_edit ? "Wyłącz edycję" : "Zezwól na edycję"}*/}
              {/*      </p>*/}
              {/*    </TooltipContent>*/}
              {/*  </Tooltip>*/}
              {/*</div>*/}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                handleRemoveUserAccess(user);
              }}
            >
              <TrashIcon className="size-5 text-red-500" />
            </Button>
          </div>
        ))}

        {/* Groups with access */}
        {groupsWithAccess.map((group) => (
          <div className="flex w-full items-center gap-1" key={group.id}>
            <div className="bg-muted/40 flex w-full items-center justify-between gap-2 rounded-md border p-2">
              <div className="flex items-center gap-2">
                <Avatar>
                  <AvatarImage src={group.photo} />
                  <AvatarFallback delayMs={600}>
                    {getInitials(group.name)}
                  </AvatarFallback>
                </Avatar>
                <p className="m-0 text-sm font-medium">{group.name}</p>
              </div>
              <div
                className="flex items-center gap-2"
                onMouseEnter={() => {
                  setHoverTooltipGroupId(group.id);
                }}
                onMouseLeave={() => {
                  setHoverTooltipGroupId(null);
                }}
              >
                <Tooltip open={hoverTooltipGroupId === group.id}>
                  <TooltipTrigger asChild>
                    <Toggle
                      pressed={group.allow_edit}
                      onPressedChange={() => {
                        handleToggleGroupEdit(group);
                      }}
                      size="sm"
                      className={cn(
                        "size-8 rounded-full p-0 transition-colors",
                        "data-[state=off]:bg-muted data-[state=on]:bg-green-500/15",
                      )}
                    >
                      {group.allow_edit ? (
                        <PencilIcon className="size-5 text-green-600" />
                      ) : (
                        <EyeIcon className="text-muted-foreground size-5" />
                      )}
                    </Toggle>
                  </TooltipTrigger>

                  <TooltipContent>
                    <p>
                      {group.allow_edit ? "Wyłącz edycję" : "Zezwól na edycję"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                handleRemoveGroupAccess(group);
              }}
            >
              <TrashIcon className="size-5 text-red-500" />
            </Button>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
