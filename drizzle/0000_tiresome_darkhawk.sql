CREATE TABLE "workspaces" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"plan" text DEFAULT 'free' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"owner_id" text NOT NULL,
	"type" text DEFAULT 'individual' NOT NULL,
	"max_users" integer DEFAULT 1 NOT NULL,
	"wallet_id" text,
	"products" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"leader_can_create" boolean DEFAULT true NOT NULL,
	"billing_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"password_hash" text NOT NULL,
	"monthly_budget_usd" numeric(14, 4),
	"assigned_project_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"organization_id" text,
	"permissions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"products" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_active_at" timestamp with time zone,
	"created_by" text DEFAULT 'system' NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"wallet_id" text NOT NULL,
	"type" text NOT NULL,
	"amount_usd" numeric(14, 4) NOT NULL,
	"reason" text DEFAULT '' NOT NULL,
	"metadata" jsonb,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" text PRIMARY KEY NOT NULL,
	"owner_id" text NOT NULL,
	"owner_type" text NOT NULL,
	"balance_usd" numeric(14, 4) DEFAULT '0' NOT NULL,
	"total_top_ups" numeric(14, 4) DEFAULT '0' NOT NULL,
	"total_spent" numeric(14, 4) DEFAULT '0' NOT NULL,
	"warning_threshold" integer DEFAULT 20 NOT NULL,
	"critical_threshold" integer DEFAULT 10 NOT NULL,
	"danger_threshold" integer DEFAULT 5 NOT NULL,
	"version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_balance_non_negative" CHECK ("wallets"."balance_usd" >= 0)
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"workspace_id" text NOT NULL,
	"created_by" text NOT NULL,
	"member_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "episodes" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"workspace_id" text NOT NULL,
	"project_id" text,
	"created_by" text NOT NULL,
	"final_video_url" text,
	"final_video_size_mb" numeric(10, 2),
	"final_video_uploaded_at" timestamp with time zone,
	"final_video_uploaded_by" text,
	"final_status" text DEFAULT 'none' NOT NULL,
	"review_note" text,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" text,
	"creator_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_workspaces_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."workspaces"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_wallet_id_wallets_id_fk" FOREIGN KEY ("wallet_id") REFERENCES "public"."wallets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects" ADD CONSTRAINT "projects_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "episodes" ADD CONSTRAINT "episodes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "users_organization_id_idx" ON "users" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "users_role_idx" ON "users" USING btree ("role");--> statement-breakpoint
CREATE INDEX "wallet_transactions_wallet_id_idx" ON "wallet_transactions" USING btree ("wallet_id");--> statement-breakpoint
CREATE INDEX "wallet_transactions_created_at_idx" ON "wallet_transactions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "wallets_owner_idx" ON "wallets" USING btree ("owner_type","owner_id");--> statement-breakpoint
CREATE INDEX "projects_workspace_id_idx" ON "projects" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "episodes_workspace_id_idx" ON "episodes" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "episodes_project_id_idx" ON "episodes" USING btree ("project_id");