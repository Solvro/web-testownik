import React from "react";
import { Button } from "react-bootstrap";
import { Icon } from "@iconify/react";
import { User, Group } from "./types";
import {AppTheme} from "../../../Theme.tsx";
import {QuizMetadata} from "../types.ts";

interface AccessListProps {
    quizMetadata: QuizMetadata | null;
    usersWithAccess: User[];
    groupsWithAccess: Group[];
    isMaintainerAnonymous: boolean;
    theme: AppTheme;
    handleRemoveUserAccess: (user: User) => void;
    handleRemoveGroupAccess: (group: Group) => void;
    handleToggleMaintainerAnonymous: () => void;
}

const AccessList: React.FC<AccessListProps> = ({
                                                   quizMetadata,
                                                   usersWithAccess,
                                                   groupsWithAccess,
                                                   isMaintainerAnonymous,
                                                   theme,
                                                   handleRemoveUserAccess,
                                                   handleRemoveGroupAccess,
                                                   handleToggleMaintainerAnonymous,
                                               }) => {
    return (
        <div className="d-flex flex-wrap gap-2" style={{ maxHeight: "16rem", overflowY: "auto" }}>
            {quizMetadata?.maintainer && (
                <div
                    key={`maintainer-${quizMetadata.maintainer.id}`}
                    className={`d-flex justify-content-between align-items-center w-100 p-2 rounded bg-${theme.getTheme()}`}
                >
                    <div className="d-flex align-items-center gap-2">
                        <img
                            src={quizMetadata.maintainer.photo}
                            alt="avatar"
                            className="rounded-circle object-fit-cover"
                            width="32"
                            height="32"
                        />
                        <p className="m-0">{quizMetadata.maintainer.full_name}</p>
                        <Icon icon="mdi:crown" className="text-warning" />
                    </div>
                    <div
                        onClick={handleToggleMaintainerAnonymous}
                        style={{ cursor: "pointer", userSelect: "none" }}
                    >
                        {isMaintainerAnonymous ? (
                            <Icon
                                icon="mdi:incognito"
                                className="text-danger bg-danger bg-opacity-25 rounded-circle p-1"
                                width="32"
                                height="32"
                            />
                        ) : (
                            <Icon
                                icon="mdi:account"
                                className="text-info bg-info bg-opacity-25 rounded-circle p-1"
                                width="32"
                                height="32"
                            />
                        )}
                    </div>
                </div>
            )}

            {/* Users with access */}
            {usersWithAccess.map((user) => (
                <div
                    key={user.id}
                    className={`d-flex justify-content-between align-items-center w-100 p-2 rounded bg-${theme.getTheme()}`}
                >
                    <div className="d-flex align-items-center gap-2">
                        <img
                            src={user.photo}
                            alt="avatar"
                            className="rounded-circle object-fit-cover"
                            width="32"
                            height="32"
                        />
                        <p className="m-0">{user.full_name}</p>
                    </div>
                    <Button
                        size="sm"
                        className="text-danger bg-danger bg-opacity-25 border-0"
                        onClick={() => handleRemoveUserAccess(user)}
                    >
                        Usuń
                    </Button>
                </div>
            ))}

            {/* Groups with access */}
            {groupsWithAccess.map((group) => (
                <div
                    key={group.id}
                    className={`d-flex justify-content-between align-items-center w-100 p-2 rounded bg-${theme.getTheme()}`}
                >
                    <div className="d-flex align-items-center gap-2">
                        <img
                            src={group.photo}
                            alt="avatar"
                            className="rounded-circle"
                            width="32"
                            height="32"
                        />
                        <p className="m-0">{group.name}</p>
                    </div>
                    <Button
                        size="sm"
                        className="text-danger bg-danger bg-opacity-25 border-0"
                        onClick={() => handleRemoveGroupAccess(group)}
                    >
                        Usuń
                    </Button>
                </div>
            ))}
        </div>
    );
};

export default AccessList;