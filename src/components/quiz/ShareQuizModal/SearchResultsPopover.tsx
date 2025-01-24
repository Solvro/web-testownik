import React, {useEffect} from "react";
import {Popover} from "react-bootstrap";
import PropagateLoader from "react-spinners/PropagateLoader";
import {User, Group} from "./types";
import {AppContextType} from "../../../AppContext.tsx";
import {PopperRef} from "react-bootstrap/types";

interface SearchResultsPopoverProps {
    searchResults: (User | Group)[];
    searchResultsLoading: boolean;
    appContext: AppContextType;
    handleAddEntity: (entity: User | Group) => void;
    inputWidth: number;
    searchQuery: string;
    // They are here to automatically update the Popover position
    accessLevel?: number;
    usersWithAccess?: User[];
    groupsWithAccess?: Group[];
    // Additional props for positioning
    style?: React.CSSProperties;
    popper?: PopperRef;
}

const SearchResultsPopover = React.forwardRef<HTMLDivElement, SearchResultsPopoverProps>(
    (
        {
            searchResults,
            searchResultsLoading,
            appContext,
            handleAddEntity,
            inputWidth,
            searchQuery,
            accessLevel,
            usersWithAccess,
            groupsWithAccess,
            style,
            popper,
            ...rest
        },
        ref
    ) => {
        useEffect(() => {
            popper?.scheduleUpdate?.();
        }, [accessLevel, usersWithAccess, groupsWithAccess, popper]);

        return (
            <Popover
                ref={ref}
                id="search-results-popover"
                style={{ maxWidth: "100%", width: inputWidth, ...style }}
                {...rest}
            >
                <Popover.Body className="d-flex flex-column gap-2 overflow-auto" style={{ maxHeight: "20rem" }}>
                    {searchResultsLoading ? (
                        <div className="d-flex justify-content-center mt-1 mb-3">
                            <PropagateLoader
                                color={appContext.theme.getOppositeThemeColor()}
                                size={10}
                            />
                        </div>
                    ) : searchResults.length > 0 ? (
                        searchResults.map((result) => (
                            <div
                                key={result.id}
                                className="d-flex align-items-center gap-2"
                                style={{ cursor: "pointer" }}
                                onClick={() => handleAddEntity(result)}
                            >
                                <img
                                    src={result.photo}
                                    alt="avatar"
                                    className="rounded-circle"
                                    width="32"
                                    height="32"
                                />
                                {"full_name" in result ? result.full_name : result.name}
                            </div>
                        ))
                    ) : searchQuery.length >= 3 ? (
                        <span className="text-center">Brak wyników</span>
                    ) : (
                        <span className="text-center">Wpisz co najmniej 3 znaki</span>
                    )}
                </Popover.Body>
            </Popover>
        );
    }
);

export default SearchResultsPopover;