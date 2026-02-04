"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function DivergenceAlert() {
  const queryClient = useQueryClient();

  const alerts = useQuery(trpc.recommendation.getDivergenceAlerts.queryOptions());

  const respond = useMutation(
    trpc.recommendation.respondToDivergence.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries();
        alerts.refetch();
        toast.success("Profile updated!");
      },
    })
  );

  // Get the first alert to show
  const alert = alerts.data?.[0];

  if (!alert) return null;

  const isNewInterest = alert.type === "new_interest";

  return (
    <Dialog open={!!alert}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isNewInterest ? "New interest detected" : "Skill check"}
          </DialogTitle>
          <DialogDescription>{alert.message}</DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
            <Badge variant="outline" className="text-base px-3 py-1">
              {alert.tagName}
            </Badge>
            <div className="flex-1 text-sm">
              {isNewInterest ? (
                <div className="space-y-1">
                  <div className="text-muted-foreground">
                    Your profile: <span className="text-foreground">Not listed</span>
                  </div>
                  <div className="text-muted-foreground">
                    Your behavior:{" "}
                    <span className="text-emerald-600 font-medium">
                      {alert.implicitScore.toFixed(1)}/10 engagement
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="text-muted-foreground">
                    Your profile:{" "}
                    <span className="text-foreground font-medium">
                      {alert.explicitScore}/5 skill
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    Your behavior:{" "}
                    <span className="text-amber-600 font-medium">
                      {alert.implicitScore.toFixed(1)}/10 engagement
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isNewInterest ? (
            <>
              <Button
                variant="outline"
                onClick={() =>
                  respond.mutate({ tagId: alert.tagId, action: "dismiss" })
                }
                disabled={respond.isPending}
              >
                Not interested
              </Button>
              <Button
                onClick={() =>
                  respond.mutate({
                    tagId: alert.tagId,
                    action: "add_skill",
                    newScore: 3,
                  })
                }
                disabled={respond.isPending}
              >
                Add to my skills
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                onClick={() =>
                  respond.mutate({ tagId: alert.tagId, action: "keep" })
                }
                disabled={respond.isPending}
              >
                Keep it (I still know this)
              </Button>
              <Button
                variant="destructive"
                onClick={() =>
                  respond.mutate({ tagId: alert.tagId, action: "remove_skill" })
                }
                disabled={respond.isPending}
              >
                Remove from skills
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
