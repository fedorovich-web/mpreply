import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'editor', 'service');
  CREATE TYPE "public"."enum_content_marketplaces" AS ENUM('wildberries', 'ozon', 'yandex-market', 'avito');
  CREATE TYPE "public"."enum_content_kind" AS ENUM('article', 'guide', 'checklist', 'methodology', 'template');
  CREATE TYPE "public"."enum_content_editorial_state" AS ENUM('draft', 'in_review', 'approved');
  CREATE TYPE "public"."enum_content_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__content_v_version_marketplaces" AS ENUM('wildberries', 'ozon', 'yandex-market', 'avito');
  CREATE TYPE "public"."enum__content_v_version_kind" AS ENUM('article', 'guide', 'checklist', 'methodology', 'template');
  CREATE TYPE "public"."enum__content_v_version_editorial_state" AS ENUM('draft', 'in_review', 'approved');
  CREATE TYPE "public"."enum__content_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum_payload_jobs_log_task_slug" AS ENUM('inline', 'schedulePublish');
  CREATE TYPE "public"."enum_payload_jobs_log_state" AS ENUM('failed', 'succeeded');
  CREATE TYPE "public"."enum_payload_jobs_task_slug" AS ENUM('inline', 'schedulePublish');
  CREATE TABLE "users_sessions" (
	"_order" integer NOT NULL,
	"_parent_id" uuid NOT NULL,
	"id" varchar PRIMARY KEY NOT NULL,
	"created_at" timestamp(3) with time zone,
	"expires_at" timestamp(3) with time zone NOT NULL
  );

  CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" "enum_users_role" DEFAULT 'editor' NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"email" varchar NOT NULL,
	"reset_password_token" varchar,
	"reset_password_expiration" timestamp(3) with time zone,
	"salt" varchar,
	"hash" varchar,
	"login_attempts" numeric DEFAULT 0,
	"lock_until" timestamp(3) with time zone
  );

  CREATE TABLE "categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar NOT NULL,
	"slug" varchar NOT NULL,
	"description" varchar,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"alt" varchar NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"url" varchar,
	"thumbnail_u_r_l" varchar,
	"filename" varchar,
	"mime_type" varchar,
	"filesize" numeric,
	"width" numeric,
	"height" numeric,
	"focal_x" numeric,
	"focal_y" numeric
  );

  CREATE TABLE "content_marketplaces" (
	"order" integer NOT NULL,
	"parent_id" uuid NOT NULL,
	"value" "enum_content_marketplaces",
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );

  CREATE TABLE "content" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar,
	"slug" varchar,
	"excerpt" varchar,
	"body" jsonb,
	"kind" "enum_content_kind",
	"category_id" uuid,
	"cover_id" uuid,
	"author_name" varchar,
	"editorial_state" "enum_content_editorial_state" DEFAULT 'draft',
	"seo_title" varchar,
	"seo_description" varchar,
	"seo_canonical" varchar,
	"seo_noindex" boolean DEFAULT false,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"_status" "enum_content_status" DEFAULT 'draft'
  );

  CREATE TABLE "_content_v_version_marketplaces" (
	"order" integer NOT NULL,
	"parent_id" uuid NOT NULL,
	"value" "enum__content_v_version_marketplaces",
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
  );

  CREATE TABLE "_content_v" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"parent_id" uuid,
	"version_title" varchar,
	"version_slug" varchar,
	"version_excerpt" varchar,
	"version_body" jsonb,
	"version_kind" "enum__content_v_version_kind",
	"version_category_id" uuid,
	"version_cover_id" uuid,
	"version_author_name" varchar,
	"version_editorial_state" "enum__content_v_version_editorial_state" DEFAULT 'draft',
	"version_seo_title" varchar,
	"version_seo_description" varchar,
	"version_seo_canonical" varchar,
	"version_seo_noindex" boolean DEFAULT false,
	"version_updated_at" timestamp(3) with time zone,
	"version_created_at" timestamp(3) with time zone,
	"version__status" "enum__content_v_version_status" DEFAULT 'draft',
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"latest" boolean,
	"autosave" boolean
  );

  CREATE TABLE "payload_kv" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar NOT NULL,
	"data" jsonb NOT NULL
  );

  CREATE TABLE "payload_jobs_log" (
	"_order" integer NOT NULL,
	"_parent_id" uuid NOT NULL,
	"id" varchar PRIMARY KEY NOT NULL,
	"executed_at" timestamp(3) with time zone NOT NULL,
	"completed_at" timestamp(3) with time zone NOT NULL,
	"task_slug" "enum_payload_jobs_log_task_slug" NOT NULL,
	"task_i_d" varchar NOT NULL,
	"input" jsonb,
	"output" jsonb,
	"state" "enum_payload_jobs_log_state" NOT NULL,
	"error" jsonb
  );

  CREATE TABLE "payload_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"input" jsonb,
	"completed_at" timestamp(3) with time zone,
	"total_tried" numeric DEFAULT 0,
	"has_error" boolean DEFAULT false,
	"error" jsonb,
	"task_slug" "enum_payload_jobs_task_slug",
	"queue" varchar DEFAULT 'default',
	"wait_until" timestamp(3) with time zone,
	"processing" boolean DEFAULT false,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "payload_locked_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"global_slug" varchar,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "payload_locked_documents_rels" (
	"id" serial PRIMARY KEY NOT NULL,
	"order" integer,
	"parent_id" uuid NOT NULL,
	"path" varchar NOT NULL,
	"users_id" uuid,
	"categories_id" uuid,
	"media_id" uuid,
	"content_id" uuid
  );

  CREATE TABLE "payload_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar,
	"value" jsonb,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  CREATE TABLE "payload_preferences_rels" (
	"id" serial PRIMARY KEY NOT NULL,
	"order" integer,
	"parent_id" uuid NOT NULL,
	"path" varchar NOT NULL,
	"users_id" uuid
  );

  CREATE TABLE "payload_migrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar,
	"batch" numeric,
	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "content_marketplaces" ADD CONSTRAINT "content_marketplaces_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "content" ADD CONSTRAINT "content_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "content" ADD CONSTRAINT "content_cover_id_media_id_fk" FOREIGN KEY ("cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_content_v_version_marketplaces" ADD CONSTRAINT "_content_v_version_marketplaces_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_content_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_content_v" ADD CONSTRAINT "_content_v_parent_id_content_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."content"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_content_v" ADD CONSTRAINT "_content_v_version_category_id_categories_id_fk" FOREIGN KEY ("version_category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_content_v" ADD CONSTRAINT "_content_v_version_cover_id_media_id_fk" FOREIGN KEY ("version_cover_id") REFERENCES "public"."media"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_jobs_log" ADD CONSTRAINT "payload_jobs_log_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."payload_jobs"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_content_fk" FOREIGN KEY ("content_id") REFERENCES "public"."content"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "content_marketplaces_order_idx" ON "content_marketplaces" USING btree ("order");
  CREATE INDEX "content_marketplaces_parent_idx" ON "content_marketplaces" USING btree ("parent_id");
  CREATE UNIQUE INDEX "content_slug_idx" ON "content" USING btree ("slug");
  CREATE INDEX "content_kind_idx" ON "content" USING btree ("kind");
  CREATE INDEX "content_category_idx" ON "content" USING btree ("category_id");
  CREATE INDEX "content_cover_idx" ON "content" USING btree ("cover_id");
  CREATE INDEX "content_editorial_state_idx" ON "content" USING btree ("editorial_state");
  CREATE INDEX "content_updated_at_idx" ON "content" USING btree ("updated_at");
  CREATE INDEX "content_created_at_idx" ON "content" USING btree ("created_at");
  CREATE INDEX "content__status_idx" ON "content" USING btree ("_status");
  CREATE INDEX "_content_v_version_marketplaces_order_idx" ON "_content_v_version_marketplaces" USING btree ("order");
  CREATE INDEX "_content_v_version_marketplaces_parent_idx" ON "_content_v_version_marketplaces" USING btree ("parent_id");
  CREATE INDEX "_content_v_parent_idx" ON "_content_v" USING btree ("parent_id");
  CREATE INDEX "_content_v_version_version_slug_idx" ON "_content_v" USING btree ("version_slug");
  CREATE INDEX "_content_v_version_version_kind_idx" ON "_content_v" USING btree ("version_kind");
  CREATE INDEX "_content_v_version_version_category_idx" ON "_content_v" USING btree ("version_category_id");
  CREATE INDEX "_content_v_version_version_cover_idx" ON "_content_v" USING btree ("version_cover_id");
  CREATE INDEX "_content_v_version_version_editorial_state_idx" ON "_content_v" USING btree ("version_editorial_state");
  CREATE INDEX "_content_v_version_version_updated_at_idx" ON "_content_v" USING btree ("version_updated_at");
  CREATE INDEX "_content_v_version_version_created_at_idx" ON "_content_v" USING btree ("version_created_at");
  CREATE INDEX "_content_v_version_version__status_idx" ON "_content_v" USING btree ("version__status");
  CREATE INDEX "_content_v_created_at_idx" ON "_content_v" USING btree ("created_at");
  CREATE INDEX "_content_v_updated_at_idx" ON "_content_v" USING btree ("updated_at");
  CREATE INDEX "_content_v_latest_idx" ON "_content_v" USING btree ("latest");
  CREATE INDEX "_content_v_autosave_idx" ON "_content_v" USING btree ("autosave");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_jobs_log_order_idx" ON "payload_jobs_log" USING btree ("_order");
  CREATE INDEX "payload_jobs_log_parent_id_idx" ON "payload_jobs_log" USING btree ("_parent_id");
  CREATE INDEX "payload_jobs_completed_at_idx" ON "payload_jobs" USING btree ("completed_at");
  CREATE INDEX "payload_jobs_total_tried_idx" ON "payload_jobs" USING btree ("total_tried");
  CREATE INDEX "payload_jobs_has_error_idx" ON "payload_jobs" USING btree ("has_error");
  CREATE INDEX "payload_jobs_task_slug_idx" ON "payload_jobs" USING btree ("task_slug");
  CREATE INDEX "payload_jobs_queue_idx" ON "payload_jobs" USING btree ("queue");
  CREATE INDEX "payload_jobs_wait_until_idx" ON "payload_jobs" USING btree ("wait_until");
  CREATE INDEX "payload_jobs_processing_idx" ON "payload_jobs" USING btree ("processing");
  CREATE INDEX "payload_jobs_updated_at_idx" ON "payload_jobs" USING btree ("updated_at");
  CREATE INDEX "payload_jobs_created_at_idx" ON "payload_jobs" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_content_id_idx" ON "payload_locked_documents_rels" USING btree ("content_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "categories" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "content_marketplaces" CASCADE;
  DROP TABLE "content" CASCADE;
  DROP TABLE "_content_v_version_marketplaces" CASCADE;
  DROP TABLE "_content_v" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_jobs_log" CASCADE;
  DROP TABLE "payload_jobs" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_users_role";
  DROP TYPE "public"."enum_content_marketplaces";
  DROP TYPE "public"."enum_content_kind";
  DROP TYPE "public"."enum_content_editorial_state";
  DROP TYPE "public"."enum_content_status";
  DROP TYPE "public"."enum__content_v_version_marketplaces";
  DROP TYPE "public"."enum__content_v_version_kind";
  DROP TYPE "public"."enum__content_v_version_editorial_state";
  DROP TYPE "public"."enum__content_v_version_status";
  DROP TYPE "public"."enum_payload_jobs_log_task_slug";
  DROP TYPE "public"."enum_payload_jobs_log_state";
  DROP TYPE "public"."enum_payload_jobs_task_slug";`)
}
