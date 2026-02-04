"use client";

import { useQuery, useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { BountyCard } from "@/components/bounty-card";
import { UserProfileCard } from "@/components/user-profile-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export default function RecommendationsView({
  session,
}: {
  session: typeof authClient.$Infer.Session;
}) {
  // Fetch recommendations
  const recommendations = useQuery(trpc.recommendation.getRecommendations.queryOptions());

  // Fetch user profile
  const userProfile = useQuery(trpc.recommendation.getUserProfile.queryOptions());

  // Fetch user tags
  const userTags = useQuery(trpc.recommendation.getUserTags.queryOptions());

  // Record view mutation
  const recordView = useMutation(
    trpc.recommendation.recordView.mutationOptions({
      onSuccess: (data) => {
        toast.success(`View recorded! Avg price: $${data.avgPrice.toFixed(0)}`);
        recommendations.refetch();
        userProfile.refetch();
      },
      onError: (error) => {
        toast.error(`Failed to record view: ${error.message}`);
      },
    })
  );

  // Record like mutation
  const recordLike = useMutation(
    trpc.recommendation.recordInteraction.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Liked! Engagement score: ${data.newEngagementScore}`);
        recommendations.refetch();
        userProfile.refetch();
      },
      onError: (error) => {
        toast.error(`Failed to like: ${error.message}`);
      },
    })
  );

  const isLoading = recommendations.isLoading || userProfile.isLoading || userTags.isLoading;
  const error = recommendations.error || userProfile.error || userTags.error;

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardContent className="py-8 text-center">
            <h2 className="text-lg font-semibold text-destructive mb-2">
              Error Loading Recommendations
            </h2>
            <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
            <Button onClick={() => recommendations.refetch()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Recommendations</h1>
        <p className="text-muted-foreground">
          Personalized bounties based on your skills and activity
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar - User Profile */}
        <div className="lg:col-span-1 space-y-4">
          {isLoading ? (
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ) : (
            <UserProfileCard
              profile={userProfile.data || null}
              tags={userTags.data || []}
              userName={session.user.name}
            />
          )}

          {/* Debug Info */}
          {recommendations.data?.debug && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Debug Info</CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-1 font-mono">
                <div>Total candidates: {recommendations.data.debug.totalCandidates}</div>
                <div>Filtered by tier: {recommendations.data.debug.filteredByTier}</div>
                <div>
                  Top relevance:{" "}
                  {recommendations.data.debug.topRelevanceScores
                    .slice(0, 3)
                    .map((s) => s.toFixed(1))
                    .join(", ")}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Main Content - Recommendations */}
        <div className="lg:col-span-3 space-y-6">
          {isLoading ? (
            <>
              <LoadingCard title="Primary Recommendation" />
              <LoadingCard title="Stretch Recommendation" />
            </>
          ) : recommendations.data ? (
            <>
              {/* Primary Recommendation */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-6 w-1 bg-primary rounded-full" />
                  <h2 className="text-lg font-semibold">Recommended for You</h2>
                  <span className="text-xs text-muted-foreground">(High Relevance)</span>
                </div>
                <BountyCard
                  {...recommendations.data.primary}
                  variant="primary"
                  onView={() => recordView.mutate({ bountyId: recommendations.data!.primary.id })}
                  onLike={() =>
                    recordLike.mutate({
                      bountyId: recommendations.data!.primary.id,
                      type: "like",
                    })
                  }
                />
              </section>

              {/* Secondary Recommendation */}
              <section>
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-6 w-1 bg-muted-foreground rounded-full" />
                  <h2 className="text-lg font-semibold">Stretch Your Skills</h2>
                  <span className="text-xs text-muted-foreground">(Lower Relevance)</span>
                </div>
                <BountyCard
                  {...recommendations.data.secondary}
                  variant="secondary"
                  onView={() =>
                    recordView.mutate({ bountyId: recommendations.data!.secondary.id })
                  }
                  onLike={() =>
                    recordLike.mutate({
                      bountyId: recommendations.data!.secondary.id,
                      type: "like",
                    })
                  }
                />
              </section>

              {/* Refresh Button */}
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => recommendations.refetch()}
                  disabled={recommendations.isFetching}
                >
                  {recommendations.isFetching ? "Loading..." : "Refresh Recommendations"}
                </Button>
              </div>
            </>
          ) : (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                No recommendations available
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingCard({ title }: { title: string }) {
  return (
    <section>
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="h-6 w-1" />
        <Skeleton className="h-5 w-48" />
      </div>
      <Card>
        <CardHeader>
          <div className="flex justify-between">
            <div className="space-y-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-6 w-64" />
            </div>
            <Skeleton className="h-8 w-20" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-16" />
            <Skeleton className="h-6 w-16" />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
