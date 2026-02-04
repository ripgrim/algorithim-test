"use client";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

interface BountyTag {
  name: string;
  weight: number;
}

interface BountyScores {
  relevance: number;
  social: number;
  price: number;
  final: number;
}

interface BountyCardProps {
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
  tags: BountyTag[];
  scores?: BountyScores;
  variant?: "primary" | "secondary";
  onLike?: () => void;
  onView?: () => void;
}

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

export function BountyCard({
  id,
  title,
  description,
  price,
  tier,
  status,
  views,
  submissions,
  likes,
  engagementScore,
  tags,
  scores,
  variant = "primary",
  onLike,
  onView,
}: BountyCardProps) {
  const isPrimary = variant === "primary";

  return (
    <Card
      className={`${isPrimary ? "border-primary/50 bg-primary/5" : "border-border"} transition-all hover:shadow-md`}
    >
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <Badge className={tierColors[tier]}>{tierLabels[tier]} Tier</Badge>
              <Badge variant={status === "open" ? "success" : "secondary"}>{status}</Badge>
            </div>
            <CardTitle className="text-base font-semibold truncate">{title}</CardTitle>
          </div>
          <div className="text-right shrink-0">
            <div className="text-2xl font-bold text-primary">${price.toLocaleString()}</div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5">
          {tags.slice(0, 5).map((tag) => (
            <Badge key={tag.name} variant="outline" className="text-xs">
              {tag.name}
              {tag.weight >= 0.8 && <span className="ml-1 text-primary">*</span>}
            </Badge>
          ))}
          {tags.length > 5 && (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              +{tags.length - 5} more
            </Badge>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold">{views.toLocaleString()}</div>
            <div className="text-xs text-muted-foreground">Views</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{submissions}</div>
            <div className="text-xs text-muted-foreground">Submissions</div>
          </div>
          <div>
            <div className="text-lg font-semibold">{likes}</div>
            <div className="text-xs text-muted-foreground">Likes</div>
          </div>
        </div>

        {/* Scores (if available) */}
        {scores && (
          <div className="space-y-2 pt-2 border-t">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Match Scores
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="text-xs w-16">Relevance</span>
                <Progress value={scores.relevance} max={10} className="flex-1 h-1.5" />
                <span className="text-xs font-mono w-8">{scores.relevance.toFixed(1)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs w-16">Social</span>
                <Progress value={scores.social} max={2} className="flex-1 h-1.5" indicatorClassName="bg-blue-500" />
                <span className="text-xs font-mono w-8">{scores.social.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs w-16">Price</span>
                <Progress value={scores.price} max={1} className="flex-1 h-1.5" indicatorClassName="bg-emerald-500" />
                <span className="text-xs font-mono w-8">{scores.price.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-2 pt-1 border-t">
                <span className="text-xs w-16 font-medium">Final</span>
                <Progress value={scores.final} max={15} className="flex-1 h-2" indicatorClassName="bg-amber-500" />
                <span className="text-xs font-mono w-8 font-bold">{scores.final.toFixed(1)}</span>
              </div>
            </div>
          </div>
        )}
      </CardContent>

      <CardFooter className="gap-2">
        <Button variant="outline" size="sm" onClick={onView} className="flex-1">
          View Details
        </Button>
        <Button variant="ghost" size="sm" onClick={onLike}>
          <HeartIcon className="w-4 h-4 mr-1" />
          Like
        </Button>
        {status === "open" && (
          <Button size="sm" className="flex-1">
            Claim Bounty
          </Button>
        )}
      </CardFooter>
    </Card>
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
