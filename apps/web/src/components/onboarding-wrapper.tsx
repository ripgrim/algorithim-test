"use client";

import { authClient } from "@/lib/auth-client";
import { OnboardingModal } from "./onboarding-modal";
import { DivergenceAlert } from "./divergence-alert";

export function OnboardingWrapper() {
  const { data: session } = authClient.useSession();

  // Only show for logged-in users
  if (!session) return null;

  return (
    <>
      <OnboardingModal />
      <DivergenceAlert />
    </>
  );
}
