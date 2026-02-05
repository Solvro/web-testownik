import {
  CrownIcon,
  EyeIcon,
  HatGlassesIcon,
  PencilIcon,
  TrashIcon,
  UserIcon,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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

function PersistentTooltip({
  pressed,
  onPressedChange,
  tooltipContentPressed,
  tooltipContentUnpressed,
  IconPressed,
  IconUnpressed,
  classNamePressed,
  classNameUnpressed,
}: {
  pressed: boolean;
  onPressedChange: (value: boolean) => void;
  tooltipContentPressed: React.ReactNode;
  tooltipContentUnpressed: React.ReactNode;
  IconPressed: LucideIcon;
  IconUnpressed: LucideIcon;
  classNamePressed: string;
  classNameUnpressed: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={open} onOpenChange={setOpen}>
        <TooltipTrigger asChild>
          <Toggle
            pressed={pressed}
            onPressedChange={(value) => {
              setOpen(true);
              onPressedChange(value);
            }}
            size="sm"
            className={cn(
              "size-8 rounded-full p-0 transition-colors",
              pressed ? classNamePressed : classNameUnpressed,
            )}
          >
            {pressed ? <IconPressed /> : <IconUnpressed />}
          </Toggle>
        </TooltipTrigger>
        <TooltipContent side="top" align="center">
          {pressed ? tooltipContentPressed : tooltipContentUnpressed}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
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
  return (
    <ScrollArea className="w-full **:data-[slot=scroll-area-viewport]:max-h-64">
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
              <PersistentTooltip
                pressed={isMaintainerAnonymous}
                onPressedChange={setIsMaintainerAnonymous}
                tooltipContentPressed="Ujawnij właściciela"
                tooltipContentUnpressed="Ukryj właściciela"
                IconPressed={HatGlassesIcon}
                IconUnpressed={UserIcon}
                classNamePressed="bg-red-500/15 text-red-500 hover:bg-red-500/20 hover:text-red-600"
                classNameUnpressed="bg-sky-500/15 text-sky-500 hover:bg-sky-500/20 hover:text-sky-600"
              />
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

              <PersistentTooltip
                pressed={user.allow_edit}
                onPressedChange={() => {
                  handleToggleUserEdit(user);
                }}
                tooltipContentPressed="Wyłącz edycję"
                tooltipContentUnpressed="Zezwól na edycję"
                IconPressed={PencilIcon}
                IconUnpressed={EyeIcon}
                classNamePressed="bg-green-500/15 text-green-500 hover:bg-green-500/20 hover:text-green-600"
                classNameUnpressed="bg-muted hover:bg-muted/20 hover:text-muted-foreground"
              />
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
              <div className="flex items-center gap-2">
                <PersistentTooltip
                  pressed={group.allow_edit}
                  onPressedChange={() => {
                    handleToggleGroupEdit(group);
                  }}
                  tooltipContentPressed="Wyłącz edycję"
                  tooltipContentUnpressed="Zezwól na edycję"
                  IconPressed={PencilIcon}
                  IconUnpressed={EyeIcon}
                  classNamePressed="bg-green-500/15 text-green-500 hover:bg-green-500/20 hover:text-green-600"
                  classNameUnpressed="bg-muted hover:bg-muted/20 hover:text-muted-foreground"
                />
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
