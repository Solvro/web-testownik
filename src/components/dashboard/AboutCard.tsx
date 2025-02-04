import React, {useEffect, useState} from "react";
import {Card, Table} from "react-bootstrap";
import {Icon} from "@iconify/react";


interface Contributor {
    login: string;
    id: number;
    node_id: string;
    avatar_url: string;
    gravatar_id: string;
    url: string;
    html_url: string;
    followers_url: string;
    following_url: string;
    gists_url: string;
    starred_url: string;
    subscriptions_url: string;
    organizations_url: string;
    repos_url: string;
    events_url: string;
    received_events_url: string;
    type: string;
    site_admin: boolean;
    contributions: number;
}

const AboutCard: React.FC = () => {
    const [contributors, setContributors] = useState<Contributor[]>([]);

    useEffect(() => {
        fetchContributors();
    }, []);

    const fetchContributors = async () => {
        try {
            const coreResponse = await fetch("https://api.github.com/repos/Solvro/backend-testownik/contributors?anon=1");
            const frontendResponse = await fetch("https://api.github.com/repos/Solvro/web-testownik/contributors?anon=1");

            const coreData = await coreResponse.json();
            const frontendData = await frontendResponse.json();

            if (coreData.message || frontendData.message) {
                throw new Error("API rate limit exceeded");
            }

            // merge data from both repositories and if there are any duplicates, sum their contributions
            const data = coreData.concat(frontendData)
                .filter((contributor: Contributor) => contributor.type === "User")
                .reduce((acc: Contributor[], contributor: Contributor) => {
                    const existingContributor = acc.find((c) => c.login === contributor.login);
                    if (existingContributor) {
                        existingContributor.contributions += contributor.contributions;
                    } else {
                        acc.push(contributor);
                    }
                    return acc;
                }, []);

            setContributors(data.sort((a: Contributor, b: Contributor) => b.contributions - a.contributions));
        } catch (e) {
            console.error(e);
            setContributors([]);
        }
    };

    return (
        <Card className="border-0 shadow flex-fill">
            <Card.Body>
                <h5 className="card-title d-flex justify-content-between align-items-center">
                    <span>Twórcy</span>
                    <div>
                        <Icon icon="mdi:github" width="24" height="24" cursor="pointer"
                              onClick={() => window.open("https://github.com/solvro/web-testownik")}/>
                    </div>
                </h5>
                <div className="overflow-y-auto">
                    <Table className="mb-0">
                        <tbody>
                        {contributors.length > 0 ? (
                            contributors.map((contributor) => (
                                <tr key={contributor.id}>
                                    <td>
                                        <a href={contributor.html_url} target="_blank" className="text-decoration-none">
                                            <img src={contributor.avatar_url} alt={contributor.login} style={{
                                                borderRadius: '50%',
                                                width: '1.5em',
                                                height: '1.5em',
                                                objectFit: 'cover'
                                            }}/>
                                            <span className="ms-2 link-secondary">{contributor.login}</span>
                                        </a>
                                    </td>
                                    <td className="text-muted">{contributor.contributions} commits</td>
                                </tr>
                            ))
                        ) : (
                            <tr>
                                <td className="text-muted">Nie udało się pobrać informacji o autorach</td>
                            </tr>
                        )}
                        </tbody>
                    </Table>
                </div>
            </Card.Body>
        </Card>
    );
};

export default AboutCard;