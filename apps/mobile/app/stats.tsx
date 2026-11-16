import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useMemo, useState } from "react";
import EmbeddedWeb from "../src/components/EmbeddedWeb";
import { ErrorScreen, Loading } from "../src/components/ui";
import { api } from "../src/lib/api";
import { tokenStore } from "../src/lib/storage";
import { ApiError } from "../src/lib/client";
import { useSession } from "../src/lib/session";

export default function Stats() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const owner = tokenStore.session();
  const client = useMemo(() => api.forSession(owner), [owner]);
  const validQuiz =
    typeof id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  const [generation, setGeneration] = useState(0);
  const session = useQuery({
    queryKey: ["embedded-stats", user?.id, id, generation],
    queryFn: () => client.post<{ access: string }>("mobile/auth/web-session/"),
    enabled: !!user && validQuiz,
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
  if (!validQuiz)
    return (
      <ErrorScreen error={new ApiError(404, "", undefined, "operation")} />
    );
  if (session.error)
    return (
      <ErrorScreen
        error={session.error}
        retry={() => setGeneration((n) => n + 1)}
      />
    );
  if (!session.data) return <Loading />;
  return (
    <EmbeddedWeb
      key={`${user?.id}-${id}-${generation}`}
      access={session.data.access}
      quizId={id}
      onRetry={() => setGeneration((n) => n + 1)}
    />
  );
}
