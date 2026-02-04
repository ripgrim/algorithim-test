import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { auth } from "@algorithim-test/auth";
import BountyFeedView from "./bounty-feed-view";

export default async function BountiesPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    redirect("/login");
  }

  return <BountyFeedView session={session} />;
}
