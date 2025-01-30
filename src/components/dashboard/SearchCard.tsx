import React, {useContext, useState} from "react";
import {Card, InputGroup, FormControl, Button, Table} from "react-bootstrap";
import AppContext from "../../AppContext.tsx";
import PropagateLoader from "react-spinners/PropagateLoader";
import {Icon} from "@iconify/react";
import {Link} from "react-router";

interface SearchResult {
    id: string;
    title: string;
    maintainer: string;
    is_anonymous: boolean;
}

const SearchCard: React.FC = () => {
    const appContext = useContext(AppContext);
    const [searchQuery, setSearchQuery] = useState<string>("");
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [isSearchedEmpty, setIsSearchedEmpty] = useState<boolean>(true);

    const handleSearch = async () => {
        if (!searchQuery) {
            setIsSearchedEmpty(true);
            setSearchResults([]);
            return;
        }
        setIsSearchedEmpty(false);

        try {
            setLoading(true);
            const response = await appContext.axiosInstance.get(`/search-quizzes/?query=${encodeURIComponent(searchQuery)}`);

            const data = Object.values(response.data).flat() as SearchResult[];
            const uniqueData = Array.from(new Set(data.map(item => item.id)))
                .map(id => data.find(item => item.id === id)) as SearchResult[];
            setSearchResults(uniqueData);
        } catch {
            setSearchResults([]);
        }
        setLoading(false);
    };

    return (
        <Card className="border-0 shadow flex-fill">
            <Card.Body>
                <InputGroup>
                    <FormControl
                        placeholder="Wyszukaj quiz"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter") {
                                handleSearch();
                            }
                        }}
                    />
                    <Button variant={"outline-" + appContext.theme.getOppositeTheme()} onClick={handleSearch}>
                        <Icon icon="ic:baseline-search" width="24" height="24"/>
                    </Button>
                </InputGroup>
                <div id="search-results" className="mt-3 overflow-y-auto" style={{maxHeight: "20rem"}}>
                    {loading ? (
                        <div className="d-flex justify-content-center pt-3">
                            <PropagateLoader color={appContext.theme.getOppositeThemeColor()} size={10}/>
                        </div>
                    ) : (
                        <Table className="mb-0">
                            <tbody>
                            {searchResults.length > 0 ? (
                                searchResults.map((result) => (
                                    <tr key={result.id}>
                                        <td>
                                            <Link to={`/quiz/${result.id}`}
                                                  className={"text-decoration-none text-" + appContext.theme.getOppositeTheme()}>
                                                {result.title}
                                                <span
                                                    className="link-secondary"> by {result.is_anonymous ? "anonim" : result.maintainer}</span>
                                            </Link>
                                        </td>
                                    </tr>
                                ))
                            ) : (isSearchedEmpty ? (
                                    <tr>
                                        <td className="text-muted">Tu pojawią się wyniki wyszukiwania.</td>
                                    </tr>
                                ) : (
                                    <tr>
                                        <td className="text-muted">Brak wyników wyszukiwania.</td>
                                    </tr>
                                )
                            )}
                            </tbody>
                        </Table>
                    )}
                </div>
            </Card.Body>
        </Card>
    );
};

export default SearchCard;