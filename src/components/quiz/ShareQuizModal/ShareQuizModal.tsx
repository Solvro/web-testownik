import React, {
    useCallback,
    useContext,
    useEffect,
    useState,
} from "react";
import {Modal, Button, Form, OverlayTrigger, Tooltip, Alert} from "react-bootstrap";
import {Icon} from "@iconify/react";
import PropagateLoader from "react-spinners/PropagateLoader";

import AppContext from "../../../AppContext.tsx";
import {AccessLevel, User, Group, SharedQuiz} from "./types";
import AccessLevelSelector from "./AccessLevelSelector.tsx";
import SearchResultsPopover from "./SearchResultsPopover.tsx";
import AccessList from "./AccessList.tsx";
import {distance} from "fastest-levenshtein";
import {QuizMetadata} from "../types.ts";

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

    const [accessLevel, setAccessLevel] = useState<AccessLevel>(AccessLevel.PRIVATE);
    const [loading, setLoading] = useState(false);

    const [initialUsersWithAccess, setInitialUsersWithAccess] = useState<User[]>([]);
    const [initialGroupsWithAccess, setInitialGroupsWithAccess] = useState<Group[]>([]);
    const [usersWithAccess, setUsersWithAccess] = useState<User[]>([]);
    const [groupsWithAccess, setGroupsWithAccess] = useState<Group[]>([]);
    const [isMaintainerAnonymous, setIsMaintainerAnonymous] = useState(false);
    const [allowAnonymous, setAllowAnonymous] = useState(false);

    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<(User | Group)[]>([]);
    const [searchResultsLoading, setSearchResultsLoading] = useState(false);
    const [userGroups, setUserGroups] = useState<Group[]>([]);

    const inputRef = useCallback((node: HTMLInputElement | null) => {
        if (node !== null) {
            setInputWidth(node.clientWidth);
            node.addEventListener("click", () => {
                setInputWidth(node.clientWidth);
            });
        }
    }, []);
    const [inputWidth, setInputWidth] = useState(0);

    useEffect(() => {
        setAccessLevel(quiz.visibility);
        setIsMaintainerAnonymous(quiz.is_anonymous);
        fetchData();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            await Promise.all([
                fetchUserGroups(),
                fetchAccess(),
            ]);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };


    const fetchAccess = async () => {
        try {
            const response = await appContext.axiosInstance.get(`/shared-quizzes/?quiz=${quiz.id}`);
            const sharedData = response.data;
            const foundUsers = sharedData.flatMap((sq: SharedQuiz) => sq.user ? [{
                ...sq.user,
                shared_quiz_id: sq.id,
            }] : []);
            const foundGroups = sharedData.flatMap((sq: SharedQuiz) => sq.group ? [{
                ...sq.group,
                photo_url: `https://ui-avatars.com/api/?background=random&name=${sq.group.name.split(" ")[0]}+${sq.group.name.split(" ")[1] || ""}&size=128`,
                shared_quiz_id: sq.id,
            }] : []);

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
                photo_url: `https://ui-avatars.com/api/?background=random&name=${
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
                    `/users/?search=${encodeURIComponent(query)}`
                );
                let data: (User | Group)[] = [...usersResponse.data];

                // Filter groups by the query
                const matchedGroups = userGroups.filter((g) =>
                    g.name.toLowerCase().includes(query.toLowerCase())
                );
                data = [...data, ...matchedGroups];

                // If query is exactly 6 digits, prioritize matching student_number
                let userByIndex: User | undefined;
                if (query.length === 6 && !isNaN(parseInt(query))) {
                    userByIndex = data.find(
                        (obj) => "student_number" in obj && obj.student_number === query
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
                        const aGroup = a as Group;
                        const bGroup = b as Group;
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
                            distance((a as Group).name, query) -
                            distance((b as User).full_name, query)
                        );
                    } else if (bIsGroup) {
                        // a is User, b is Group
                        return (
                            distance((a as User).full_name, query) -
                            distance((b as Group).name, query)
                        );
                    } else {
                        // both users
                        return (
                            distance((a as User).full_name, query) -
                            distance((b as User).full_name, query)
                        );
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
        [userGroups, appContext.axiosInstance]
    );

    const handleAddEntity = (entity: User | Group) => {
        // If it's a user
        if ("full_name" in entity) {
            // Prevent duplicates
            if (!usersWithAccess.find((u) => u.id === entity.id) && entity.id !== quiz.maintainer?.id) {
                setUsersWithAccess((prev) => [...prev, entity]);
            }
        } else {
            // It's a group
            if (!groupsWithAccess.find((g) => g.id === entity.id)) {
                setGroupsWithAccess((prev) => [...prev, entity]);
            }
        }
        setSearchQuery("");
        setSearchResults([]);
    };

    const handleRemoveUserAccess = (user: User) => {
        setUsersWithAccess((prev) => prev.filter((u) => u.id !== user.id));
    };

    const handleRemoveGroupAccess = (group: Group) => {
        setGroupsWithAccess((prev) => prev.filter((g) => g.id !== group.id));
    };

    const handleToggleMaintainerAnonymous = () => {
        setIsMaintainerAnonymous((prev) => !prev);
    };

    const handleToggleAllowAnonymous = (checked: boolean) => {
        setAllowAnonymous(checked);
    };

    // -------------- Save Handler -------------- //
    const handleSave = async () => {

        try {
            // 1) Update quiz metadata (visibility, allow_anonymous, is_anonymous)
            const quizResponse = await appContext.axiosInstance.patch(`/quizzes/${quiz.id}/`, {
                visibility: accessLevel,
                allow_anonymous: allowAnonymous && accessLevel >= AccessLevel.UNLISTED,
                is_anonymous: isMaintainerAnonymous,
            });

            const removedUsers = initialUsersWithAccess.filter(
                (u) => !usersWithAccess.some((u2) => u2.id === u.id)
            );
            const addedUsers = usersWithAccess.filter(
                (u) => !initialUsersWithAccess.some((u2) => u2.id === u.id)
            );

            const removedGroups = initialGroupsWithAccess.filter(
                (g) => !groupsWithAccess.some((g2) => g2.id === g.id)
            );
            const addedGroups = groupsWithAccess.filter(
                (g) => !initialGroupsWithAccess.some((g2) => g2.id === g.id)
            );


            for (const rUser of removedUsers) {
                await appContext.axiosInstance.delete(
                    `/shared-quizzes/${rUser.shared_quiz_id}/`
                );
            }

            for (const rGroup of removedGroups) {
                await appContext.axiosInstance.delete(
                    `/shared-quizzes/${rGroup.shared_quiz_id}/`
                );
            }

            for (const aUser of addedUsers) {
                await appContext.axiosInstance.post(`/shared-quizzes/`, {
                    quiz_id: quiz.id,
                    user_id: aUser.id,
                });
            }

            for (const aGroup of addedGroups) {
                await appContext.axiosInstance.post(`/shared-quizzes/`, {
                    quiz_id: quiz.id,
                    study_group_id: aGroup.id,
                });
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
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton>
                <Modal.Title>Udostępnij "{quiz.title}"</Modal.Title>
            </Modal.Header>

            <Modal.Body>
                <OverlayTrigger
                    overlay={
                        <SearchResultsPopover
                            searchResults={searchResults}
                            searchResultsLoading={searchResultsLoading}
                            appContext={appContext}
                            handleAddEntity={handleAddEntity}
                            inputWidth={inputWidth}
                            searchQuery={searchQuery}
                            accessLevel={accessLevel}
                            usersWithAccess={usersWithAccess}
                            groupsWithAccess={groupsWithAccess}
                        />
                    }
                    placement="bottom"
                    show={searchQuery.length > 0 && show}
                >
                    <Form.Control
                        placeholder="Wpisz imię/nazwisko, grupę lub numer indeksu..."
                        className="mb-2"
                        ref={inputRef}
                        value={searchQuery}
                        onChange={handleSearchInput}
                        onKeyUp={() => {
                            if (searchQuery.length >= 3) handleSearch(searchQuery);
                        }}
                    />
                </OverlayTrigger>

                <h6>Dostęp mają:</h6>
                {loading ? (
                    <div className="d-flex justify-content-center w-100 mt-1 mb-3">
                        <PropagateLoader
                            color={appContext.theme.getOppositeThemeColor()}
                            size={10}
                        />
                    </div>
                ) : (
                    <AccessList
                        quizMetadata={quiz}
                        usersWithAccess={usersWithAccess}
                        groupsWithAccess={groupsWithAccess}
                        isMaintainerAnonymous={isMaintainerAnonymous}
                        theme={appContext.theme}
                        handleRemoveUserAccess={handleRemoveUserAccess}
                        handleRemoveGroupAccess={handleRemoveGroupAccess}
                        handleToggleMaintainerAnonymous={handleToggleMaintainerAnonymous}
                    />
                )}

                <h6 className="mt-3">Poziom dostępu:</h6>
                <AccessLevelSelector value={accessLevel} onChange={setAccessLevel}/>

                {accessLevel >= AccessLevel.UNLISTED && (
                    <div className="mt-2">
                        <Form.Check
                            type="switch"
                            id="anonymous-switch"
                            label="Pozwól na dostęp dla niezalogowanych"
                            checked={allowAnonymous}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                                handleToggleAllowAnonymous(e.target.checked)
                            }
                        />
                    </div>
                )}

                {accessLevel == AccessLevel.PRIVATE && (usersWithAccess.length > 0 || groupsWithAccess.length > 0) && (
                    <div className="mt-3">
                        <Alert variant="warning" className="mb-0">
                            Ustawiono dostęp prywatny, ale dodano użytkowników/grupy. Baza nie będzie dla nich dostępna.
                        </Alert>
                    </div>
                )}
            </Modal.Body>

            <Modal.Footer>
                <div className="d-flex justify-content-between w-100">
                    <OverlayTrigger
                        overlay={
                            <Tooltip id="copy-link-tooltip">
                                Link do quizu został skopiowany do schowka
                            </Tooltip>
                        }
                        placement="bottom"
                        trigger="click"
                        rootClose
                    >
                        <Button
                            variant={`outline-${appContext.theme.getOppositeTheme()}`}
                            onClick={() => {
                                navigator.clipboard.writeText(
                                    `${window.location.origin}/quiz/${quiz.id}`
                                );
                            }}
                            className="d-inline-flex align-items-center"
                        >
                            <Icon icon={"mdi:link-variant"} className="me-1"/>
                            Kopiuj link
                        </Button>
                    </OverlayTrigger>
                    <Button variant="primary" onClick={handleSave}>
                        Zapisz
                    </Button>
                </div>
            </Modal.Footer>
        </Modal>
    );
};

export default ShareQuizModal;