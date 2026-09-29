import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import EmbeddedWeb from "../src/components/EmbeddedWeb";
import { ErrorScreen, Loading } from "../src/components/ui";
import { api } from "../src/lib/api";
import { useSession } from "../src/lib/session";

export default function Stats() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useSession();
  const [generation, setGeneration] = useState(0);
  const session = useQuery({
    queryKey: ["embedded-stats", user?.id, id, generation],
    queryFn: () => api.post<{ access: string }>("mobile/auth/web-session/"),
    gcTime: 0,
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
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
      key={`${id}-${generation}`}
      access={session.data.access}
      quizId={id}
      onRetry={() => setGeneration((n) => n + 1)}
    />
  );
}
