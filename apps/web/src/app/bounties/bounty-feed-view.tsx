"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";
import { UserProfileCard } from "@/components/user-profile-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

type SortOption = "relevance" | "price_high" | "price_low" | "engagement" | "newest";
type Tier = "basic" | "middle" | "high";

const sortLabels: Record<SortOption, string> = {
  relevance: "Relevance",
  price_high: "Price (High to Low)",
  price_low: "Price (Low to High)",
  engagement: "Most Engaged",
  newest: "Newest First",
};

const tierColors = {
  basic: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400",
  middle: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  high: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
};

const tierLabels = {
  basic: "Basic",
  middle: "Middle",
  high: "High",
};

export default function BountyFeedView({
  session,
}: {
  session: typeof authClient.$Infer.Session;
}) {
  const queryClient = useQueryClient();
  const [sortBy, setSortBy] = useState<SortOption>("relevance");
  const [tierFilter, setTierFilter] = useState<Tier[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  // Fetch bounty feed
  const feed = useQuery(
    trpc.recommendation.getBountyFeed.queryOptions({
      sortBy,
      tierFilter: tierFilter.length > 0 ? tierFilter : undefined,
      limit: 50,
    })
  );

  // Fetch user tags for the sidebar
  const userTags = useQuery(trpc.recommendation.getUserTags.queryOptions());

  // Record view mutation
  const recordView = useMutation(
    trpc.recommendation.recordView.mutationOptions({
      onSuccess: (data) => {
        toast.success(`View recorded! Avg price: $${data.avgPrice.toFixed(0)}`);
        feed.refetch();
      },
    })
  );

  // Record like mutation
  const recordLike = useMutation(
    trpc.recommendation.recordInteraction.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Liked! Engagement: ${data.newEngagementScore}`);
        feed.refetch();
      },
    })
  );

  const toggleTier = (tier: Tier) => {
    setTierFilter((prev) =>
      prev.includes(tier) ? prev.filter((t) => t !== tier) : [...prev, tier]
    );
  };

  const isLoading = feed.isLoading || userTags.isLoading;
  const error = feed.error || userTags.error;

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardContent className="py-8 text-center">
            <h2 className="text-lg font-semibold text-destructive mb-2">Error Loading Feed</h2>
            <p className="text-sm text-muted-foreground mb-4">{error.message}</p>
            <Button onClick={() => feed.refetch()}>Try Again</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Bounty Feed</h1>
          <p className="text-muted-foreground">
            {feed.data?.pagination.total ?? 0} bounties available
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Debug Toggle */}
          <Button
            variant={showDebug ? "default" : "outline"}
            size="sm"
            onClick={() => setShowDebug(!showDebug)}
          >
            <BugIcon className="w-4 h-4 mr-2" />
            Debug {showDebug ? "ON" : "OFF"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => feed.refetch()}
            disabled={feed.isFetching}
          >
            {feed.isFetching ? "Loading..." : "Refresh"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-4">
          {/* User Profile */}
          {isLoading ? (
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent className="space-y-4">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          ) : (
            <UserProfileCard
              profile={feed.data?.userProfile ?? null}
              tags={userTags.data ?? []}
              userName={session.user.name}
            />
          )}

          {/* Filters */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Filters</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sort */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Sort By</Label>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className="w-full flex items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background hover:bg-accent hover:text-accent-foreground"
                  >
                    {sortLabels[sortBy]}
                    <ChevronDownIcon className="w-4 h-4 ml-2" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-48">
                    {(Object.keys(sortLabels) as SortOption[]).map((option) => (
                      <DropdownMenuItem key={option} onClick={() => setSortBy(option)}>
                        {sortLabels[option]}
                        {sortBy === option && <CheckIcon className="w-4 h-4 ml-auto" />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              {/* Tier Filter */}
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Tier</Label>
                <div className="space-y-2">
                  {(["basic", "middle", "high"] as Tier[]).map((tier) => (
                    <div key={tier} className="flex items-center space-x-2">
                      <Checkbox
                        id={`tier-${tier}`}
                        checked={tierFilter.includes(tier)}
                        onCheckedChange={() => toggleTier(tier)}
                      />
                      <Label
                        htmlFor={`tier-${tier}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {tierLabels[tier]}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Clear Filters */}
              {tierFilter.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setTierFilter([])}
                >
                  Clear Filters
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Debug Legend (when debug mode is on) */}
          {showDebug && (
            <>
              <Card className="border-dashed border-amber-500/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-amber-600 dark:text-amber-400">
                    Ranking Formula
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-xs space-y-2">
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span>Skills match</span>
                      <span className="font-mono">55%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Price fit</span>
                      <span className="font-mono">20%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Social proof</span>
                      <span className="font-mono">15%</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Popularity</span>
                      <span className="font-mono">10%</span>
                    </div>
                  </div>
                  <div className="border-t pt-2 mt-2 text-muted-foreground">
                    <p>Min skill match: 3/10</p>
                  </div>
                </CardContent>
              </Card>

              {/* Debug Profile Editor */}
              {feed.data?.userProfile && userTags.data && (
                <DebugProfileEditor
                  profile={feed.data.userProfile}
                  tags={userTags.data}
                  onUpdate={() => {
                    feed.refetch();
                    userTags.refetch();
                  }}
                />
              )}
            </>
          )}
        </div>

        {/* Main Content - Bounty Grid */}
        <div className="lg:col-span-3">
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Card key={i}>
                  <CardHeader>
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-4 w-2/3" />
                  </CardHeader>
                  <CardContent>
                    <Skeleton className="h-20 w-full" />
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : feed.data?.bounties.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No bounties found matching your filters.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {feed.data?.bounties.map((bounty, index) => (
                <FeedBountyCard
                  key={bounty.id}
                  bounty={bounty}
                  rank={sortBy === "relevance" ? index + 1 : undefined}
                  showDebug={showDebug}
                  userTags={feed.data?.userTags ?? []}
                  avgPriceViewed={feed.data?.userProfile?.avgPriceViewed ?? 0}
                  onView={() => recordView.mutate({ bountyId: bounty.id })}
                  onLike={() => recordLike.mutate({ bountyId: bounty.id, type: "like" })}
                />
              ))}
            </div>
          )}

          {/* Pagination info */}
          {feed.data && feed.data.pagination.total > feed.data.pagination.limit && (
            <div className="mt-6 text-center text-sm text-muted-foreground">
              Showing {Math.min(feed.data.pagination.limit, feed.data.pagination.total)} of{" "}
              {feed.data.pagination.total} bounties
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============ Feed Bounty Card with Debug Overlay ============

interface TagMatch {
  tagId: number;
  tagName: string;
  userScore: number;
  bountyWeight: number;
  contribution: number;
}

interface FeedBounty {
  id: number;
  title: string;
  description: string;
  price: number;
  tier: "basic" | "middle" | "high";
  status: "open" | "claimed" | "completed" | "expired";
  views: number;
  submissions: number;
  likes: number;
  engagementScore: number;
  tags: { name: string; weight: number }[];
  scores: {
    relevance: number;
    social: number;
    price: number;
    final: number;
  };
  debug: {
    tagMatches: TagMatch[];
    priceRatio: number | null;
    mutualCount: number;
  };
}

interface FeedBountyCardProps {
  bounty: FeedBounty;
  rank?: number;
  showDebug: boolean;
  userTags: { tagId: number; tagName: string; score: number }[];
  avgPriceViewed: number;
  onView: () => void;
  onLike: () => void;
}

function FeedBountyCard({
  bounty,
  rank,
  showDebug,
  userTags,
  avgPriceViewed,
  onView,
  onLike,
}: FeedBountyCardProps) {
  // Determine score quality for color coding (max final score is now ~10)
  const getScoreColor = (score: number, max: number) => {
    const ratio = score / max;
    if (ratio >= 0.7) return "text-emerald-600 dark:text-emerald-400";
    if (ratio >= 0.4) return "text-amber-600 dark:text-amber-400";
    return "text-red-500 dark:text-red-400";
  };

  return (
    <Card className="relative overflow-hidden transition-all hover:shadow-md">
      {/* Rank badge for relevance sort */}
      {rank && rank <= 3 && (
        <div
          className={`absolute top-0 right-0 w-8 h-8 flex items-center justify-center text-xs font-bold ${
            rank === 1
              ? "bg-amber-500 text-white"
              : rank === 2
                ? "bg-zinc-400 text-white"
                : "bg-amber-700 text-white"
          }`}
          style={{ clipPath: "polygon(100% 0, 0 0, 100% 100%)" }}
        >
          <span className="translate-x-1 -translate-y-1">#{rank}</span>
        </div>
      )}

      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2 pr-6">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={tierColors[bounty.tier]}>{tierLabels[bounty.tier]}</Badge>
              {showDebug && (
                <Badge
                  variant="outline"
                  className={`font-mono text-xs ${getScoreColor(bounty.scores.final, 10)}`}
                >
                  {bounty.scores.final.toFixed(2)}
                </Badge>
              )}
            </div>
            <CardTitle className="text-sm font-semibold line-clamp-2">{bounty.title}</CardTitle>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xl font-bold text-primary">${bounty.price.toLocaleString()}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground line-clamp-2">{bounty.description}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1">
          {bounty.tags.slice(0, 4).map((tag) => {
            // Check if user has this tag
            const userHasTag = userTags.some(
              (ut) => ut.tagName.toLowerCase() === tag.name.toLowerCase()
            );
            return (
              <Badge
                key={tag.name}
                variant="outline"
                className={`text-xs ${userHasTag ? "border-primary bg-primary/10" : ""}`}
              >
                {tag.name}
                {showDebug && userHasTag && <span className="ml-1 text-primary">*</span>}
              </Badge>
            );
          })}
          {bounty.tags.length > 4 && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              +{bounty.tags.length - 4}
            </Badge>
          )}
        </div>

        {/* Mini stats */}
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>{bounty.views} views</span>
          <span>{bounty.submissions} submissions</span>
          <span>{bounty.likes} likes</span>
        </div>

        {/* Debug Overlay - "Why this bounty?" */}
        {showDebug && (
          <DebugWhyThisBounty
            bounty={bounty}
            avgPriceViewed={avgPriceViewed}
          />
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onView} className="flex-1">
            View
          </Button>
          <Button variant="ghost" size="sm" onClick={onLike}>
            <HeartIcon className="w-4 h-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ============ Helper Components ============

function DebugWhyThisBounty({
  bounty,
  avgPriceViewed,
}: {
  bounty: FeedBounty;
  avgPriceViewed: number;
}) {
  const matchedTags = bounty.debug.tagMatches.filter((m) => m.userScore > 0);
  const missingTags = bounty.debug.tagMatches.filter((m) => m.userScore === 0);

  // Skill match quality
  const getSkillVerdict = () => {
    if (bounty.scores.relevance >= 8) return { text: "Excellent", color: "text-emerald-600" };
    if (bounty.scores.relevance >= 6) return { text: "Good", color: "text-emerald-600" };
    if (bounty.scores.relevance >= 4) return { text: "Partial", color: "text-amber-600" };
    return { text: "Weak", color: "text-red-500" };
  };

  // Price verdict - based on how close bounty price is to user's avg viewed
  const getPriceVerdict = () => {
    if (bounty.scores.price >= 0.8) return { text: "Great fit", color: "text-emerald-600" };
    if (bounty.scores.price >= 0.5) return { text: "Reasonable", color: "text-amber-600" };
    if (bounty.scores.price >= 0.3) return { text: "Below your range", color: "text-orange-500" };
    return { text: "Way below your range", color: "text-red-500" };
  };

  const skillVerdict = getSkillVerdict();
  const priceVerdict = getPriceVerdict();

  return (
    <div className="border-t pt-3 mt-2 text-xs space-y-2">
      {/* Skills */}
      <div className="flex items-start gap-2">
        <span className="text-muted-foreground w-12 shrink-0">Skills</span>
        <div className="flex-1">
          <span className={`font-medium ${skillVerdict.color}`}>
            {skillVerdict.text} ({bounty.scores.relevance.toFixed(1)}/10)
          </span>
          {matchedTags.length > 0 && (
            <span className="text-muted-foreground">
              {" "}- you know {matchedTags.map((m) => `${m.tagName} (${m.userScore}/5)`).join(", ")}
            </span>
          )}
          {missingTags.length > 0 && (
            <span className="text-muted-foreground">
              {matchedTags.length > 0 ? "; " : " - "}missing {missingTags.map((m) => m.tagName).join(", ")}
            </span>
          )}
        </div>
      </div>

      {/* Price */}
      <div className="flex items-start gap-2">
        <span className="text-muted-foreground w-12 shrink-0">Price</span>
        <div className="flex-1">
          <span className={`font-medium ${priceVerdict.color}`}>
            {priceVerdict.text} ({bounty.scores.price.toFixed(2)})
          </span>
          <span className="text-muted-foreground">
            {" "}- ${bounty.price.toLocaleString()}
            {avgPriceViewed > 0 && (
              <> vs your avg ${avgPriceViewed.toFixed(0)}</>
            )}
          </span>
        </div>
      </div>

      {/* Social (only show if there's activity) */}
      {bounty.scores.social > 0 && (
        <div className="flex items-start gap-2">
          <span className="text-muted-foreground w-12 shrink-0">Social</span>
          <div className="flex-1">
            <span className="font-medium text-blue-600">
              +{bounty.scores.social.toFixed(2)} boost
            </span>
            <span className="text-muted-foreground"> - people you follow engaged</span>
          </div>
        </div>
      )}

      {/* Final score */}
      <div className="flex items-start gap-2 pt-1 border-t border-dashed">
        <span className="text-muted-foreground w-12 shrink-0">Score</span>
        <div className="flex-1">
          <span className="font-mono font-medium">{bounty.scores.final.toFixed(2)}</span>
          <span className="text-muted-foreground">
            {" "}= skills×55% + price×20% + social×15% + popularity×10%
          </span>
        </div>
      </div>
    </div>
  );
}

// ============ Icons ============

function BugIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m8 2 1.88 1.88" />
      <path d="M14.12 3.88 16 2" />
      <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
      <path d="M12 20v-9" />
      <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
      <path d="M6 13H2" />
      <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
      <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
      <path d="M22 13h-4" />
      <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
    </svg>
  );
}

function ChevronDownIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function HeartIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    </svg>
  );
}

// ============ Debug Profile Editor ============

function DebugProfileEditor({
  profile,
  tags,
  onUpdate,
}: {
  profile: {
    accessTier: Tier;
    avgPriceViewed: number;
    engagementScore: number;
    platformScore: number;
  };
  tags: { tagId: number; tagName: string; category: string; score: number }[];
  onUpdate: () => void;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [editingTag, setEditingTag] = useState<number | null>(null);
  
  // Local state for all editable fields
  const [avgPrice, setAvgPrice] = useState(profile.avgPriceViewed);
  const [tier, setTier] = useState<Tier>(profile.accessTier);
  const [platformScore, setPlatformScore] = useState(profile.platformScore);
  const [engagementScore, setEngagementScore] = useState(profile.engagementScore);

  const updateTags = useMutation(
    trpc.recommendation.updateUserTags.mutationOptions({
      onSuccess: () => {
        toast.success("Skills updated!");
        onUpdate();
        setEditingTag(null);
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const updateProfile = useMutation(
    trpc.recommendation.updateDebugProfile.mutationOptions({
      onSuccess: (data) => {
        const fields = Object.keys(data.updated).join(", ");
        toast.success(`Updated: ${fields}`);
        // Sync local state with saved values
        if (data.updated.avgPriceViewed !== undefined) setAvgPrice(data.updated.avgPriceViewed);
        if (data.updated.accessTier !== undefined) setTier(data.updated.accessTier);
        if (data.updated.platformScore !== undefined) setPlatformScore(data.updated.platformScore);
        if (data.updated.engagementScore !== undefined) setEngagementScore(data.updated.engagementScore);
        onUpdate();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const handleTagScoreChange = (tagId: number, newScore: number) => {
    const newTags = tags.map((t) =>
      t.tagId === tagId ? { tagId: t.tagId, score: newScore } : { tagId: t.tagId, score: t.score }
    );
    // Filter out tags with score 0
    const filtered = newTags.filter((t) => t.score > 0);
    updateTags.mutate({ tags: filtered });
  };

  const handleSaveProfile = () => {
    const updates: {
      avgPriceViewed?: number;
      accessTier?: Tier;
      platformScore?: number;
      engagementScore?: number;
    } = {};

    if (avgPrice !== profile.avgPriceViewed) {
      updates.avgPriceViewed = avgPrice;
    }
    if (tier !== profile.accessTier) {
      updates.accessTier = tier;
    }
    if (platformScore !== profile.platformScore) {
      updates.platformScore = platformScore;
    }
    if (engagementScore !== profile.engagementScore) {
      updates.engagementScore = engagementScore;
    }

    if (Object.keys(updates).length > 0) {
      updateProfile.mutate(updates);
    }
  };

  const hasChanges =
    avgPrice !== profile.avgPriceViewed ||
    tier !== profile.accessTier ||
    platformScore !== profile.platformScore ||
    engagementScore !== profile.engagementScore;

  const tierOptions: Tier[] = ["basic", "middle", "high"];

  return (
    <Card className="border-dashed border-orange-500/50">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm text-orange-600 dark:text-orange-400">
            Edit Profile (Debug)
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? "Collapse" : "Expand"}
          </Button>
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent className="space-y-4 text-xs">
          {/* Access Tier */}
          <div className="space-y-2">
            <Label className="text-xs">Access Tier</Label>
            <div className="flex gap-1">
              {tierOptions.map((t) => (
                <button
                  key={t}
                  onClick={() => setTier(t)}
                  className={`flex-1 px-2 py-1.5 text-xs rounded border transition-all capitalize ${
                    tier === t
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted hover:bg-muted/80 border-border"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Platform Score */}
          <div className="space-y-2">
            <Label className="text-xs">Platform Score: {platformScore.toFixed(1)} / 10</Label>
            <Slider
              value={[platformScore]}
              onValueChange={(v) => {
                const val = Array.isArray(v) ? v[0] : v;
                setPlatformScore(val ?? 0);
              }}
              min={0}
              max={10}
              step={0.5}
              className="flex-1"
            />
          </div>

          {/* Engagement Score */}
          <div className="space-y-2">
            <Label className="text-xs">Engagement Score: {engagementScore} / 100</Label>
            <Slider
              value={[engagementScore]}
              onValueChange={(v) => {
                const val = Array.isArray(v) ? v[0] : v;
                setEngagementScore(val ?? 0);
              }}
              min={0}
              max={100}
              step={5}
              className="flex-1"
            />
          </div>

          {/* Avg Price Viewed */}
          <div className="space-y-2">
            <Label className="text-xs">Avg Price Viewed: ${avgPrice}</Label>
            <Slider
              value={[avgPrice]}
              onValueChange={(v) => {
                const val = Array.isArray(v) ? v[0] : v;
                setAvgPrice(val ?? 0);
              }}
              min={0}
              max={5000}
              step={50}
              className="flex-1"
            />
          </div>

          {/* Save Button */}
          {hasChanges && (
            <Button
              size="sm"
              className="w-full"
              onClick={handleSaveProfile}
              disabled={updateProfile.isPending}
            >
              {updateProfile.isPending ? "Saving..." : "Save Profile Changes"}
            </Button>
          )}

          {/* Divider */}
          <div className="border-t pt-3">
            <Label className="text-xs">Your Skills (click to edit)</Label>
          </div>

          {/* Skills */}
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {tags.map((tag) => (
              <div key={tag.tagId} className="flex items-center gap-2">
                <span className="w-24 truncate text-muted-foreground">{tag.tagName}</span>
                {editingTag === tag.tagId ? (
                  <div className="flex gap-1">
                    {[0, 1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        onClick={() => handleTagScoreChange(tag.tagId, score)}
                        disabled={updateTags.isPending}
                        className={`w-6 h-6 text-xs rounded border transition-all ${
                          tag.score === score
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-muted hover:bg-muted/80 border-border"
                        }`}
                      >
                        {score}
                      </button>
                    ))}
                  </div>
                ) : (
                  <button
                    onClick={() => setEditingTag(tag.tagId)}
                    className="flex gap-0.5"
                  >
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className={`w-3 h-3 rounded-sm ${
                          i <= tag.score ? "bg-primary" : "bg-muted"
                        }`}
                      />
                    ))}
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Set to 0 to remove a skill. Changes affect recommendations immediately.
          </p>
        </CardContent>
      )}
    </Card>
  );
}
