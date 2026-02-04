import { auth } from "@algorithim-test/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import RecommendationsView from "./recommendations-view";

export default async function RecommendationsPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    redirect("/login");
  }

  return <RecommendationsView session={session} />;
}
