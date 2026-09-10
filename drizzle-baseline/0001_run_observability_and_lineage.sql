CREATE TABLE "run_asset_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" text NOT NULL,
	"asset_id" text NOT NULL,
	"direction" text NOT NULL,
	"role" text NOT NULL,
	"parameter_path" text,
	"ordinal" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_asset_links_direction_check" CHECK ("run_asset_links"."direction" in ('input', 'output')),
	CONSTRAINT "run_asset_links_ordinal_check" CHECK ("run_asset_links"."ordinal" >= 0)
);
--> statement-breakpoint
CREATE TABLE "run_usage_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"event_id" text NOT NULL,
	"run_id" text NOT NULL,
	"gateway_request_id" text NOT NULL,
	"occurred_at" timestamp with time zone,
	"source" text DEFAULT 'pymthouse' NOT NULL,
	"pipeline" text,
	"model_id" text,
	"network_fee_usd_micros" numeric(78, 18),
	"fee_wei" numeric(78, 0),
	"pixels" numeric(78, 18),
	"eth_usd_price" numeric(78, 18),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "run_usage_receipts_source_check" CHECK ("run_usage_receipts"."source" in ('pymthouse'))
);
--> statement-breakpoint
ALTER TABLE "run_asset_links" ADD CONSTRAINT "run_asset_links_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_asset_links" ADD CONSTRAINT "run_asset_links_asset_id_mcp_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."mcp_assets"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "run_usage_receipts" ADD CONSTRAINT "run_usage_receipts_run_id_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."runs"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "run_asset_links_edge_unique" ON "run_asset_links" USING btree ("run_id","asset_id","direction","parameter_path","ordinal");--> statement-breakpoint
CREATE INDEX "run_asset_links_run_idx" ON "run_asset_links" USING btree ("run_id","direction");--> statement-breakpoint
CREATE INDEX "run_asset_links_asset_idx" ON "run_asset_links" USING btree ("asset_id","direction");--> statement-breakpoint
CREATE UNIQUE INDEX "run_usage_receipts_event_unique" ON "run_usage_receipts" USING btree ("event_id");--> statement-breakpoint
CREATE INDEX "run_usage_receipts_run_occurred_idx" ON "run_usage_receipts" USING btree ("run_id","occurred_at");--> statement-breakpoint
CREATE INDEX "run_usage_receipts_gateway_idx" ON "run_usage_receipts" USING btree ("gateway_request_id");