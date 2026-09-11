CREATE TABLE "run_payment_manifests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" text NOT NULL,
	"external_account_id" uuid NOT NULL,
	"manifest_id" text NOT NULL,
	"accepted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"network_fee_usd_micros" numeric(48, 18),
	"fee_wei" text,
	"observed_at" timestamp with time zone,
	CONSTRAINT "run_payment_manifests_nonnegative_fee" CHECK ("run_payment_manifests"."network_fee_usd_micros" >= 0)
);
--> statement-breakpoint
ALTER TABLE "run_payment_manifests" ADD CONSTRAINT "run_payment_manifests_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_payment_manifests" ADD CONSTRAINT "run_payment_manifests_external_account_id_external_accounts_id_fk" FOREIGN KEY ("external_account_id") REFERENCES "public"."external_accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "run_payment_manifests_account_manifest_unique" ON "run_payment_manifests" USING btree ("external_account_id","manifest_id");--> statement-breakpoint
CREATE INDEX "run_payment_manifests_run_idx" ON "run_payment_manifests" USING btree ("run_id");