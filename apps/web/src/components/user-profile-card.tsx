"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

interface UserTag {
  tagId: number;
  tagName: string;
  category: string;
  score: number;
}

interface UserProfile {
  accessTier: "basic" | "middle" | "high";
  avgPriceViewed: number;
  engagementScore: number;
  platformScore: number;
  totalInteractions?: number;
}

interface UserProfileCardProps {
  profile: UserProfile | null;
  tags: UserTag[];
  userName?: string;
}

const tierColors = {
  basic: "bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20",
  middle: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  high: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

const tierLabels = {
  basic: "Basic Tier",
  middle: "Middle Tier",
  high: "High Tier",
};

const tierDescriptions = {
  basic: "Access to $10-$200 bounties",
  middle: "Access to $10-$1,000 bounties",
  high: "Access to all bounties",
};

export function UserProfileCard({ profile, tags, userName }: UserProfileCardProps) {
  if (!profile) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          <p>Profile not found</p>
          <p className="text-sm mt-2">Complete your profile setup to get recommendations.</p>
        </CardContent>
      </Card>
    );
  }

  // Group tags by category
  const tagsByCategory = tags.reduce(
    (acc, tag) => {
      if (!acc[tag.category]) {
        acc[tag.category] = [];
      }
      acc[tag.category].push(tag);
      return acc;
    },
    {} as Record<string, UserTag[]>
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{userName || "Your Profile"}</CardTitle>
          <Badge className={tierColors[profile.accessTier]}>{tierLabels[profile.accessTier]}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">{tierDescriptions[profile.accessTier]}</p>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Platform Score */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Platform Score</span>
            <span className="font-semibold">{profile.platformScore.toFixed(1)}/10</span>
          </div>
          <Progress value={profile.platformScore} max={10} />
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted/50 rounded-md p-3 text-center">
            <div className="text-lg font-bold">${profile.avgPriceViewed.toFixed(0)}</div>
            <div className="text-xs text-muted-foreground">Avg Price Viewed</div>
          </div>
          <div className="bg-muted/50 rounded-md p-3 text-center">
            <div className="text-lg font-bold">{profile.engagementScore.toFixed(0)}</div>
            <div className="text-xs text-muted-foreground">Engagement Score</div>
          </div>
        </div>

        {/* Tags by Category */}
        {Object.keys(tagsByCategory).length > 0 && (
          <div className="space-y-3 pt-2 border-t">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Your Skills
            </div>
            {Object.entries(tagsByCategory).map(([category, categoryTags]) => (
              <div key={category} className="space-y-1.5">
                <div className="text-xs text-muted-foreground capitalize">{category}</div>
                <div className="flex flex-wrap gap-1.5">
                  {categoryTags
                    .sort((a, b) => b.score - a.score)
                    .map((tag) => (
                      <Badge
                        key={tag.tagId}
                        variant="outline"
                        className={`text-xs ${tag.score >= 4 ? "border-primary/50 bg-primary/5" : ""}`}
                      >
                        {tag.tagName}
                        <span className="ml-1 text-muted-foreground">{tag.score}</span>
                      </Badge>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tags.length === 0 && (
          <div className="text-center text-sm text-muted-foreground py-2">
            No skills configured yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
