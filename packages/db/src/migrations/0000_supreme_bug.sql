CREATE TYPE "public"."bounty_status" AS ENUM('open', 'claimed', 'completed', 'expired');--> statement-breakpoint
CREATE TYPE "public"."bounty_tier" AS ENUM('basic', 'middle', 'high');--> statement-breakpoint
CREATE TYPE "public"."deadline_style" AS ENUM('quick', 'standard', 'long_term');--> statement-breakpoint
CREATE TYPE "public"."risk_tolerance" AS ENUM('safe', 'balanced', 'adventurous');--> statement-breakpoint
CREATE TYPE "public"."time_commitment" AS ENUM('side_hustle', 'part_time', 'full_time');--> statement-breakpoint
CREATE TYPE "public"."timezone_preference" AS ENUM('async_only', 'some_overlap', 'flexible');--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bounty" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"price" integer NOT NULL,
	"tier" "bounty_tier" NOT NULL,
	"status" "bounty_status" DEFAULT 'open' NOT NULL,
	"views" integer DEFAULT 0 NOT NULL,
	"submissions" integer DEFAULT 0 NOT NULL,
	"likes" integer DEFAULT 0 NOT NULL,
	"engagement_score" real DEFAULT 0 NOT NULL,
	"creator_id" text,
	"claimed_by_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "bounty_interaction" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"bounty_id" integer NOT NULL,
	"type" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bounty_tag" (
	"id" serial PRIMARY KEY NOT NULL,
	"bounty_id" integer NOT NULL,
	"tag_id" integer NOT NULL,
	"weight" real DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bounty_view" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"bounty_id" integer NOT NULL,
	"viewed_at" timestamp DEFAULT now() NOT NULL,
	"duration" integer
);
--> statement-breakpoint
CREATE TABLE "todo" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	"completed" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"popularity" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tag_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "mutual" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"mutual_id" text NOT NULL,
	"layer" integer DEFAULT 1 NOT NULL,
	"strength" real DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_profile" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"total_interactions" integer DEFAULT 0 NOT NULL,
	"engagement_score" real DEFAULT 0 NOT NULL,
	"avg_price_viewed" real DEFAULT 0 NOT NULL,
	"access_tier" "bounty_tier" DEFAULT 'basic' NOT NULL,
	"github_account_age" integer,
	"github_pr_acceptance_rate" real,
	"github_languages" text,
	"platform_score" real DEFAULT 2 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_profile_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_tag" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tag_id" integer NOT NULL,
	"score" integer NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recommendation_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"primary_bounty_id" integer,
	"secondary_bounty_id" integer,
	"primary_score" real,
	"secondary_score" real,
	"reason_primary" text,
	"reason_secondary" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_behavior_price" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"avg_price_viewed" real DEFAULT 0 NOT NULL,
	"avg_price_liked" real DEFAULT 0 NOT NULL,
	"avg_price_submitted" real DEFAULT 0 NOT NULL,
	"avg_price_completed" real DEFAULT 0 NOT NULL,
	"implicit_price_min" real,
	"implicit_price_max" real,
	"last_explicit_min" real,
	"last_explicit_max" real,
	"divergence_detected" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_behavior_price_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_behavior_tag" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"tag_id" integer NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"view_score" real DEFAULT 0 NOT NULL,
	"like_count" integer DEFAULT 0 NOT NULL,
	"like_score" real DEFAULT 0 NOT NULL,
	"submit_count" integer DEFAULT 0 NOT NULL,
	"submit_score" real DEFAULT 0 NOT NULL,
	"complete_count" integer DEFAULT 0 NOT NULL,
	"complete_score" real DEFAULT 0 NOT NULL,
	"implicit_score" real DEFAULT 0 NOT NULL,
	"last_explicit_score" real,
	"divergence_detected" boolean DEFAULT false,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_blend_config" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"explicit_weight" real DEFAULT 0.8 NOT NULL,
	"implicit_weight" real DEFAULT 0.2 NOT NULL,
	"total_interactions" integer DEFAULT 0 NOT NULL,
	"divergence_threshold" real DEFAULT 3 NOT NULL,
	"last_divergence_prompt" timestamp,
	"divergence_prompt_count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_blend_config_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_onboarding" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"time_commitment" time_commitment,
	"timezone_preference" timezone_preference,
	"deadline_style" "deadline_style",
	"tech_stack" jsonb,
	"price_range_min" integer DEFAULT 100,
	"price_range_max" integer DEFAULT 5000,
	"bounty_types" jsonb,
	"risk_tolerance" "risk_tolerance",
	"completed_at" timestamp,
	"current_step" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_onboarding_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty" ADD CONSTRAINT "bounty_creator_id_user_id_fk" FOREIGN KEY ("creator_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty" ADD CONSTRAINT "bounty_claimed_by_id_user_id_fk" FOREIGN KEY ("claimed_by_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty_interaction" ADD CONSTRAINT "bounty_interaction_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty_interaction" ADD CONSTRAINT "bounty_interaction_bounty_id_bounty_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounty"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty_tag" ADD CONSTRAINT "bounty_tag_bounty_id_bounty_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounty"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty_tag" ADD CONSTRAINT "bounty_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty_view" ADD CONSTRAINT "bounty_view_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bounty_view" ADD CONSTRAINT "bounty_view_bounty_id_bounty_id_fk" FOREIGN KEY ("bounty_id") REFERENCES "public"."bounty"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mutual" ADD CONSTRAINT "mutual_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mutual" ADD CONSTRAINT "mutual_mutual_id_user_id_fk" FOREIGN KEY ("mutual_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_profile" ADD CONSTRAINT "user_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tag" ADD CONSTRAINT "user_tag_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_tag" ADD CONSTRAINT "user_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_log" ADD CONSTRAINT "recommendation_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_log" ADD CONSTRAINT "recommendation_log_primary_bounty_id_bounty_id_fk" FOREIGN KEY ("primary_bounty_id") REFERENCES "public"."bounty"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recommendation_log" ADD CONSTRAINT "recommendation_log_secondary_bounty_id_bounty_id_fk" FOREIGN KEY ("secondary_bounty_id") REFERENCES "public"."bounty"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_behavior_price" ADD CONSTRAINT "user_behavior_price_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_behavior_tag" ADD CONSTRAINT "user_behavior_tag_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_blend_config" ADD CONSTRAINT "user_blend_config_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_onboarding" ADD CONSTRAINT "user_onboarding_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "bounty_tier_idx" ON "bounty" USING btree ("tier");--> statement-breakpoint
CREATE INDEX "bounty_status_idx" ON "bounty" USING btree ("status");--> statement-breakpoint
CREATE INDEX "bounty_creator_idx" ON "bounty" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "bounty_price_idx" ON "bounty" USING btree ("price");--> statement-breakpoint
CREATE INDEX "bounty_engagement_idx" ON "bounty" USING btree ("engagement_score");--> statement-breakpoint
CREATE INDEX "bounty_interaction_user_idx" ON "bounty_interaction" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bounty_interaction_bounty_idx" ON "bounty_interaction" USING btree ("bounty_id");--> statement-breakpoint
CREATE INDEX "bounty_interaction_type_idx" ON "bounty_interaction" USING btree ("type");--> statement-breakpoint
CREATE INDEX "bounty_tag_bounty_idx" ON "bounty_tag" USING btree ("bounty_id");--> statement-breakpoint
CREATE INDEX "bounty_tag_tag_idx" ON "bounty_tag" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "bounty_view_user_idx" ON "bounty_view" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "bounty_view_bounty_idx" ON "bounty_view" USING btree ("bounty_id");--> statement-breakpoint
CREATE INDEX "bounty_view_time_idx" ON "bounty_view" USING btree ("viewed_at");--> statement-breakpoint
CREATE INDEX "tag_name_idx" ON "tag" USING btree ("name");--> statement-breakpoint
CREATE INDEX "tag_category_idx" ON "tag" USING btree ("category");--> statement-breakpoint
CREATE INDEX "mutual_user_idx" ON "mutual" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "mutual_mutual_idx" ON "mutual" USING btree ("mutual_id");--> statement-breakpoint
CREATE INDEX "mutual_layer_idx" ON "mutual" USING btree ("layer");--> statement-breakpoint
CREATE INDEX "user_profile_user_idx" ON "user_profile" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_profile_tier_idx" ON "user_profile" USING btree ("access_tier");--> statement-breakpoint
CREATE INDEX "user_profile_score_idx" ON "user_profile" USING btree ("platform_score");--> statement-breakpoint
CREATE INDEX "user_tag_user_idx" ON "user_tag" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_tag_tag_idx" ON "user_tag" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "user_tag_score_idx" ON "user_tag" USING btree ("score");--> statement-breakpoint
CREATE INDEX "recommendation_log_user_idx" ON "recommendation_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recommendation_log_time_idx" ON "recommendation_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "recommendation_log_primary_idx" ON "recommendation_log" USING btree ("primary_bounty_id");--> statement-breakpoint
CREATE INDEX "recommendation_log_secondary_idx" ON "recommendation_log" USING btree ("secondary_bounty_id");--> statement-breakpoint
CREATE INDEX "user_behavior_price_user_idx" ON "user_behavior_price" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_behavior_tag_user_idx" ON "user_behavior_tag" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_behavior_tag_tag_idx" ON "user_behavior_tag" USING btree ("tag_id");--> statement-breakpoint
CREATE INDEX "user_behavior_tag_implicit_idx" ON "user_behavior_tag" USING btree ("implicit_score");--> statement-breakpoint
CREATE INDEX "user_behavior_tag_divergence_idx" ON "user_behavior_tag" USING btree ("divergence_detected");--> statement-breakpoint
CREATE INDEX "user_blend_config_user_idx" ON "user_blend_config" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_onboarding_user_idx" ON "user_onboarding" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_onboarding_completed_idx" ON "user_onboarding" USING btree ("completed_at");