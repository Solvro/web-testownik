import { Redirect } from "expo-router";

import AppTabs from "../../src/components/AppTabs";
import { Loading } from "../../src/components/ui";
import { useSession } from "../../src/lib/session";

export default function Layout() {
  const s = useSession();
  if (!s.ready) return <Loading />;
  if (!s.user) return <Redirect href="/login" />;
  return <AppTabs />;
}
