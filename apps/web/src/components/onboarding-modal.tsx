"use client";

import { useState, useEffect } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import { Progress } from "@/components/ui/progress";

// ============ TYPES ============

interface SkillSelection {
  tagId: number;
  name: string;
  score: number;
}

type TimeCommitment = "side_hustle" | "part_time" | "full_time";
type TimezonePreference = "async_only" | "some_overlap" | "flexible";
type DeadlineStyle = "quick" | "standard" | "long_term";
type RiskTolerance = "safe" | "balanced" | "adventurous";

// ============ MAIN COMPONENT ============

export function OnboardingModal() {
  const queryClient = useQueryClient();

  // Check onboarding status
  const status = useQuery(trpc.onboarding.getStatus.queryOptions());
  const tags = useQuery(trpc.onboarding.getTags.queryOptions());

  // Initialize mutation
  const initialize = useMutation(
    trpc.onboarding.initialize.mutationOptions({
      onSuccess: () => {
        status.refetch();
      },
    })
  );

  // Step mutations
  const saveSkills = useMutation(trpc.onboarding.saveSkills.mutationOptions());
  const saveWorkLife = useMutation(trpc.onboarding.saveWorkLife.mutationOptions());
  const saveTechStack = useMutation(trpc.onboarding.saveTechStack.mutationOptions());
  const savePreferences = useMutation(trpc.onboarding.savePreferences.mutationOptions());
  const goToStep = useMutation(trpc.onboarding.goToStep.mutationOptions());

  // Local state
  const [currentStep, setCurrentStep] = useState(1);

  // Step 1: Skills
  const [selectedSkills, setSelectedSkills] = useState<SkillSelection[]>([]);

  // Step 2: Work Life
  const [timeCommitment, setTimeCommitment] = useState<TimeCommitment>("part_time");
  const [timezonePreference, setTimezonePreference] = useState<TimezonePreference>("flexible");
  const [deadlineStyle, setDeadlineStyle] = useState<DeadlineStyle>("standard");

  // Step 3: Tech Stack
  const [techStack, setTechStack] = useState<{
    frontend: string[];
    backend: string[];
    database: string[];
    infra: string[];
  }>({
    frontend: [],
    backend: [],
    database: [],
    infra: [],
  });

  // Step 4: Preferences
  const [priceRange, setPriceRange] = useState<[number, number]>([100, 2000]);
  const [bountyTypes, setBountyTypes] = useState<string[]>([]);
  const [riskTolerance, setRiskTolerance] = useState<RiskTolerance>("balanced");

  // Initialize onboarding if needed
  useEffect(() => {
    if (status.data && !status.data.started && !status.data.completed) {
      initialize.mutate();
    }
  }, [status.data]);

  // Sync current step from server
  useEffect(() => {
    if (status.data?.currentStep) {
      setCurrentStep(status.data.currentStep);
    }
  }, [status.data?.currentStep]);

  // Don't show if completed or loading
  if (status.isLoading || tags.isLoading) return null;
  if (status.data?.completed) return null;

  const isOpen = status.data?.started && !status.data?.completed;

  // ============ HANDLERS ============

  const handleSkillToggle = (tagId: number, name: string) => {
    setSelectedSkills((prev) => {
      const existing = prev.find((s) => s.tagId === tagId);
      if (existing) {
        return prev.filter((s) => s.tagId !== tagId);
      }
      return [...prev, { tagId, name, score: 3 }]; // Default score 3
    });
  };

  const handleSkillScoreChange = (tagId: number, score: number) => {
    setSelectedSkills((prev) =>
      prev.map((s) => (s.tagId === tagId ? { ...s, score } : s))
    );
  };

  const handleTechStackToggle = (category: keyof typeof techStack, item: string) => {
    setTechStack((prev) => ({
      ...prev,
      [category]: prev[category].includes(item)
        ? prev[category].filter((i) => i !== item)
        : [...prev[category], item],
    }));
  };

  const handleBountyTypeToggle = (type: string) => {
    setBountyTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const handleNext = async () => {
    try {
      if (currentStep === 1) {
        if (selectedSkills.length === 0) {
          toast.error("Please select at least one skill");
          return;
        }
        await saveSkills.mutateAsync({
          skills: selectedSkills.map((s) => ({ tagId: s.tagId, score: s.score })),
        });
      } else if (currentStep === 2) {
        await saveWorkLife.mutateAsync({
          timeCommitment,
          timezonePreference,
          deadlineStyle,
        });
      } else if (currentStep === 3) {
        await saveTechStack.mutateAsync({ techStack });
      } else if (currentStep === 4) {
        await savePreferences.mutateAsync({
          priceRangeMin: priceRange[0],
          priceRangeMax: priceRange[1],
          bountyTypes,
          riskTolerance,
        });
        toast.success("Onboarding complete!");
        queryClient.invalidateQueries();
        status.refetch();
        return;
      }

      setCurrentStep((prev) => prev + 1);
      status.refetch();
    } catch (error) {
      toast.error("Failed to save. Please try again.");
    }
  };

  const handleBack = async () => {
    if (currentStep > 1) {
      await goToStep.mutateAsync({ step: currentStep - 1 });
      setCurrentStep((prev) => prev - 1);
      status.refetch();
    }
  };

  const progress = ((currentStep - 1) / 4) * 100;

  // ============ RENDER ============

  return (
    <Dialog open={isOpen}>
      <DialogContent showCloseButton={false} className="sm:max-w-lg">
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0">
          <Progress value={progress} className="h-1 rounded-none" />
        </div>

        <DialogHeader className="pt-2">
          <DialogTitle>
            {currentStep === 1 && "What are you good at?"}
            {currentStep === 2 && "How do you like to work?"}
            {currentStep === 3 && "What's your tech stack?"}
            {currentStep === 4 && "What matters to you?"}
          </DialogTitle>
          <DialogDescription>
            Step {currentStep} of 4 - This helps us find the right bounties for you.
          </DialogDescription>
        </DialogHeader>

        <div className="py-4 max-h-[60vh] overflow-y-auto">
          {/* Step 1: Skills */}
          {currentStep === 1 && (
            <Step1Skills
              tags={tags.data || {}}
              selectedSkills={selectedSkills}
              onToggle={handleSkillToggle}
              onScoreChange={handleSkillScoreChange}
            />
          )}

          {/* Step 2: Work Life */}
          {currentStep === 2 && (
            <Step2WorkLife
              timeCommitment={timeCommitment}
              timezonePreference={timezonePreference}
              deadlineStyle={deadlineStyle}
              onTimeCommitmentChange={setTimeCommitment}
              onTimezonePreferenceChange={setTimezonePreference}
              onDeadlineStyleChange={setDeadlineStyle}
            />
          )}

          {/* Step 3: Tech Stack */}
          {currentStep === 3 && (
            <Step3TechStack
              techStack={techStack}
              onToggle={handleTechStackToggle}
            />
          )}

          {/* Step 4: Preferences */}
          {currentStep === 4 && (
            <Step4Preferences
              priceRange={priceRange}
              bountyTypes={bountyTypes}
              riskTolerance={riskTolerance}
              onPriceRangeChange={setPriceRange}
              onBountyTypeToggle={handleBountyTypeToggle}
              onRiskToleranceChange={setRiskTolerance}
            />
          )}
        </div>

        <DialogFooter>
          {currentStep > 1 && (
            <Button variant="outline" onClick={handleBack} disabled={goToStep.isPending}>
              Back
            </Button>
          )}
          <Button
            onClick={handleNext}
            disabled={
              saveSkills.isPending ||
              saveWorkLife.isPending ||
              saveTechStack.isPending ||
              savePreferences.isPending
            }
          >
            {currentStep === 4 ? "Complete" : "Next"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============ STEP COMPONENTS ============

function Step1Skills({
  tags,
  selectedSkills,
  onToggle,
  onScoreChange,
}: {
  tags: Record<string, { id: number; name: string }[]>;
  selectedSkills: SkillSelection[];
  onToggle: (tagId: number, name: string) => void;
  onScoreChange: (tagId: number, score: number) => void;
}) {
  const categoryLabels: Record<string, string> = {
    language: "Languages",
    framework: "Frameworks",
    domain: "Domains",
    skill: "Skills",
    tool: "Tools",
  };

  return (
    <div className="space-y-6">
      {Object.entries(tags).map(([category, categoryTags]) => (
        <div key={category}>
          <h4 className="text-sm font-medium mb-2">
            {categoryLabels[category] || category}
          </h4>
          <div className="flex flex-wrap gap-2">
            {categoryTags.map((tag) => {
              const selected = selectedSkills.find((s) => s.tagId === tag.id);
              return (
                <Badge
                  key={tag.id}
                  variant={selected ? "default" : "outline"}
                  className="cursor-pointer transition-all"
                  onClick={() => onToggle(tag.id, tag.name)}
                >
                  {tag.name}
                  {selected && (
                    <span className="ml-1 text-xs opacity-75">{selected.score}</span>
                  )}
                </Badge>
              );
            })}
          </div>
        </div>
      ))}

      {/* Score adjustment for selected skills */}
      {selectedSkills.length > 0 && (
        <div className="border-t pt-4 mt-4">
          <h4 className="text-sm font-medium mb-3">Rate your proficiency (1-5)</h4>
          <div className="space-y-3">
            {selectedSkills.map((skill) => (
              <div key={skill.tagId} className="flex items-center gap-3">
                <span className="text-sm w-24 truncate">{skill.name}</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={score}
                      onClick={() => onScoreChange(skill.tagId, score)}
                      className={`w-8 h-8 text-xs rounded border transition-all ${
                        skill.score === score
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted hover:bg-muted/80 border-border"
                      }`}
                    >
                      {score}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Step2WorkLife({
  timeCommitment,
  timezonePreference,
  deadlineStyle,
  onTimeCommitmentChange,
  onTimezonePreferenceChange,
  onDeadlineStyleChange,
}: {
  timeCommitment: TimeCommitment;
  timezonePreference: TimezonePreference;
  deadlineStyle: DeadlineStyle;
  onTimeCommitmentChange: (v: TimeCommitment) => void;
  onTimezonePreferenceChange: (v: TimezonePreference) => void;
  onDeadlineStyleChange: (v: DeadlineStyle) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Time Commitment */}
      <div>
        <Label className="text-sm font-medium">Time Commitment</Label>
        <RadioGroup
          value={timeCommitment}
          onValueChange={(v) => onTimeCommitmentChange(v as TimeCommitment)}
          className="mt-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="side_hustle" id="tc-1" />
            <Label htmlFor="tc-1" className="font-normal cursor-pointer">
              Side hustle (&lt; 10 hrs/week)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="part_time" id="tc-2" />
            <Label htmlFor="tc-2" className="font-normal cursor-pointer">
              Part-time (10-20 hrs/week)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="full_time" id="tc-3" />
            <Label htmlFor="tc-3" className="font-normal cursor-pointer">
              Full-time (20+ hrs/week)
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Timezone */}
      <div>
        <Label className="text-sm font-medium">Timezone Preference</Label>
        <RadioGroup
          value={timezonePreference}
          onValueChange={(v) => onTimezonePreferenceChange(v as TimezonePreference)}
          className="mt-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="async_only" id="tz-1" />
            <Label htmlFor="tz-1" className="font-normal cursor-pointer">
              Async only - no meetings
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="some_overlap" id="tz-2" />
            <Label htmlFor="tz-2" className="font-normal cursor-pointer">
              Some overlap needed
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="flexible" id="tz-3" />
            <Label htmlFor="tz-3" className="font-normal cursor-pointer">
              Flexible
            </Label>
          </div>
        </RadioGroup>
      </div>

      {/* Deadline Style */}
      <div>
        <Label className="text-sm font-medium">Deadline Style</Label>
        <RadioGroup
          value={deadlineStyle}
          onValueChange={(v) => onDeadlineStyleChange(v as DeadlineStyle)}
          className="mt-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="quick" id="ds-1" />
            <Label htmlFor="ds-1" className="font-normal cursor-pointer">
              Quick turnaround (&lt; 1 week)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="standard" id="ds-2" />
            <Label htmlFor="ds-2" className="font-normal cursor-pointer">
              Standard (1-4 weeks)
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="long_term" id="ds-3" />
            <Label htmlFor="ds-3" className="font-normal cursor-pointer">
              Long-term projects (4+ weeks)
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}

function Step3TechStack({
  techStack,
  onToggle,
}: {
  techStack: {
    frontend: string[];
    backend: string[];
    database: string[];
    infra: string[];
  };
  onToggle: (category: keyof typeof techStack, item: string) => void;
}) {
  const options = {
    frontend: ["React", "Vue", "Svelte", "Angular", "Next.js", "None"],
    backend: ["Node.js", "Python", "Go", "Rust", "Java", "Ruby"],
    database: ["PostgreSQL", "MySQL", "MongoDB", "Redis", "SQLite"],
    infra: ["AWS", "GCP", "Azure", "Vercel", "Docker", "Kubernetes"],
  };

  const categoryLabels = {
    frontend: "Frontend",
    backend: "Backend",
    database: "Database",
    infra: "Infrastructure",
  };

  return (
    <div className="space-y-6">
      {(Object.keys(options) as (keyof typeof options)[]).map((category) => (
        <div key={category}>
          <Label className="text-sm font-medium">{categoryLabels[category]}</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {options[category].map((item) => (
              <Badge
                key={item}
                variant={techStack[category].includes(item) ? "default" : "outline"}
                className="cursor-pointer transition-all"
                onClick={() => onToggle(category, item)}
              >
                {item}
              </Badge>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function Step4Preferences({
  priceRange,
  bountyTypes,
  riskTolerance,
  onPriceRangeChange,
  onBountyTypeToggle,
  onRiskToleranceChange,
}: {
  priceRange: [number, number];
  bountyTypes: string[];
  riskTolerance: RiskTolerance;
  onPriceRangeChange: (v: [number, number]) => void;
  onBountyTypeToggle: (type: string) => void;
  onRiskToleranceChange: (v: RiskTolerance) => void;
}) {
  const bountyTypeOptions = [
    { id: "bug_fix", label: "Bug fixes" },
    { id: "feature", label: "New features" },
    { id: "full_project", label: "Full projects" },
    { id: "code_review", label: "Code review" },
    { id: "docs", label: "Documentation" },
  ];

  return (
    <div className="space-y-6">
      {/* Price Range */}
      <div>
        <Label className="text-sm font-medium">Price Range</Label>
        <div className="mt-4 px-2">
          <Slider
            value={priceRange}
            onValueChange={(v) => onPriceRangeChange(v as [number, number])}
            min={10}
            max={5000}
            step={10}
          />
          <div className="flex justify-between mt-2 text-sm text-muted-foreground">
            <span>${priceRange[0]}</span>
            <span>${priceRange[1]}</span>
          </div>
        </div>
      </div>

      {/* Bounty Types */}
      <div>
        <Label className="text-sm font-medium">Bounty Types</Label>
        <div className="space-y-2 mt-2">
          {bountyTypeOptions.map((type) => (
            <div key={type.id} className="flex items-center space-x-2">
              <Checkbox
                id={type.id}
                checked={bountyTypes.includes(type.id)}
                onCheckedChange={() => onBountyTypeToggle(type.id)}
              />
              <Label htmlFor={type.id} className="font-normal cursor-pointer">
                {type.label}
              </Label>
            </div>
          ))}
        </div>
      </div>

      {/* Risk Tolerance */}
      <div>
        <Label className="text-sm font-medium">Risk Tolerance</Label>
        <RadioGroup
          value={riskTolerance}
          onValueChange={(v) => onRiskToleranceChange(v as RiskTolerance)}
          className="mt-2"
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="safe" id="rt-1" />
            <Label htmlFor="rt-1" className="font-normal cursor-pointer">
              Safe - established clients, clear specs
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="balanced" id="rt-2" />
            <Label htmlFor="rt-2" className="font-normal cursor-pointer">
              Balanced
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="adventurous" id="rt-3" />
            <Label htmlFor="rt-3" className="font-normal cursor-pointer">
              Adventurous - new clients, vague specs, higher pay
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}
