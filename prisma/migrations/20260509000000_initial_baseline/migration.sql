-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'admin');

-- CreateEnum
CREATE TYPE "KeyBindingStatus" AS ENUM ('active', 'disabled', 'expired');

-- CreateEnum
CREATE TYPE "ImageTaskType" AS ENUM ('generation', 'edit');

-- CreateEnum
CREATE TYPE "ImageTaskStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'canceled');

-- CreateEnum
CREATE TYPE "CommunityWorkVisibility" AS ENUM ('private', 'unlisted', 'public');

-- CreateEnum
CREATE TYPE "CommunityWorkReviewStatus" AS ENUM ('pending', 'approved', 'rejected', 'taken_down');

-- CreateEnum
CREATE TYPE "CommunityReportStatus" AS ENUM ('open', 'reviewed', 'dismissed');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "sub2api_user_id" TEXT,
    "display_name" TEXT,
    "avatar_url" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key_binding_id" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "key_bindings" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "sub2api_base_url" TEXT NOT NULL,
    "sub2api_api_key_ciphertext" TEXT,
    "sub2api_api_key_id" TEXT,
    "default_model" TEXT NOT NULL DEFAULT 'gpt-image-2',
    "enabled_models" JSONB NOT NULL,
    "limits" JSONB NOT NULL,
    "status" "KeyBindingStatus" NOT NULL DEFAULT 'active',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "key_bindings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_user_id" TEXT,
    "action" TEXT NOT NULL,
    "target_type" TEXT NOT NULL,
    "target_id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "ip_hash" TEXT,
    "user_agent_hash" TEXT,
    "metadata" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "runtime_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by_user_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "runtime_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "image_tasks" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "key_binding_id" TEXT,
    "type" "ImageTaskType" NOT NULL,
    "status" "ImageTaskStatus" NOT NULL,
    "prompt" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "usage" JSONB,
    "upstream_request_id" TEXT,
    "error_code" TEXT,
    "error_message" TEXT,
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_batches" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_batch_items" (
    "id" TEXT NOT NULL,
    "batch_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "size" TEXT NOT NULL,
    "status" "ImageTaskStatus" NOT NULL,
    "queue_status" TEXT NOT NULL,
    "retry_count" INTEGER NOT NULL DEFAULT 0,
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_batch_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_assets" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "task_id" TEXT,
    "storage_key" TEXT,
    "mime_type" TEXT,
    "format" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "size_bytes" INTEGER,
    "favorite" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "image_assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "image_asset_tags" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "image_asset_tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "albums" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "cover_asset_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "albums_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "album_items" (
    "id" TEXT NOT NULL,
    "album_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "album_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_works" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,
    "visibility" "CommunityWorkVisibility" NOT NULL DEFAULT 'private',
    "review_status" "CommunityWorkReviewStatus" NOT NULL DEFAULT 'approved',
    "title" TEXT NOT NULL,
    "scene" TEXT,
    "tags" TEXT[],
    "prompt_snapshot" TEXT NOT NULL,
    "params_snapshot" JSONB NOT NULL,
    "disclose_prompt" BOOLEAN NOT NULL DEFAULT false,
    "disclose_params" BOOLEAN NOT NULL DEFAULT false,
    "disclose_reference_images" BOOLEAN NOT NULL DEFAULT false,
    "allow_same_generation" BOOLEAN NOT NULL DEFAULT false,
    "allow_reference_reuse" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "taken_down_at" TIMESTAMP(3),
    "featured_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_works_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_reports" (
    "id" TEXT NOT NULL,
    "work_id" TEXT NOT NULL,
    "reporter_user_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "CommunityReportStatus" NOT NULL DEFAULT 'open',
    "reviewer_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_work_likes" (
    "id" TEXT NOT NULL,
    "work_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_work_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "community_work_favorites" (
    "id" TEXT NOT NULL,
    "work_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "community_work_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sessions_user_id_idx" ON "sessions"("user_id");

-- CreateIndex
CREATE INDEX "sessions_key_binding_id_idx" ON "sessions"("key_binding_id");

-- CreateIndex
CREATE INDEX "sessions_expires_at_idx" ON "sessions"("expires_at");

-- CreateIndex
CREATE INDEX "key_bindings_user_id_idx" ON "key_bindings"("user_id");

-- CreateIndex
CREATE INDEX "key_bindings_status_idx" ON "key_bindings"("status");

-- CreateIndex
CREATE INDEX "audit_logs_actor_user_id_idx" ON "audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "audit_logs_request_id_idx" ON "audit_logs"("request_id");

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_idx" ON "audit_logs"("target_type", "target_id");

-- CreateIndex
CREATE INDEX "runtime_settings_updated_by_user_id_idx" ON "runtime_settings"("updated_by_user_id");

-- CreateIndex
CREATE INDEX "image_tasks_user_id_created_at_idx" ON "image_tasks"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "image_tasks_key_binding_id_idx" ON "image_tasks"("key_binding_id");

-- CreateIndex
CREATE INDEX "image_tasks_status_idx" ON "image_tasks"("status");

-- CreateIndex
CREATE INDEX "image_batches_user_id_created_at_idx" ON "image_batches"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "image_batches_status_idx" ON "image_batches"("status");

-- CreateIndex
CREATE INDEX "image_batch_items_batch_id_status_idx" ON "image_batch_items"("batch_id", "status");

-- CreateIndex
CREATE INDEX "image_batch_items_task_id_idx" ON "image_batch_items"("task_id");

-- CreateIndex
CREATE INDEX "image_assets_user_id_created_at_idx" ON "image_assets"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "image_assets_task_id_idx" ON "image_assets"("task_id");

-- CreateIndex
CREATE INDEX "image_assets_favorite_idx" ON "image_assets"("favorite");

-- CreateIndex
CREATE INDEX "image_assets_deleted_at_idx" ON "image_assets"("deleted_at");

-- CreateIndex
CREATE INDEX "image_asset_tags_user_id_name_idx" ON "image_asset_tags"("user_id", "name");

-- CreateIndex
CREATE UNIQUE INDEX "image_asset_tags_asset_id_name_key" ON "image_asset_tags"("asset_id", "name");

-- CreateIndex
CREATE INDEX "albums_user_id_created_at_idx" ON "albums"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "album_items_asset_id_idx" ON "album_items"("asset_id");

-- CreateIndex
CREATE UNIQUE INDEX "album_items_album_id_asset_id_key" ON "album_items"("album_id", "asset_id");

-- CreateIndex
CREATE INDEX "community_works_user_id_created_at_idx" ON "community_works"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "community_works_asset_id_idx" ON "community_works"("asset_id");

-- CreateIndex
CREATE INDEX "community_works_visibility_review_status_created_at_idx" ON "community_works"("visibility", "review_status", "created_at");

-- CreateIndex
CREATE INDEX "community_works_visibility_review_status_featured_at_idx" ON "community_works"("visibility", "review_status", "featured_at");

-- CreateIndex
CREATE INDEX "community_reports_work_id_status_idx" ON "community_reports"("work_id", "status");

-- CreateIndex
CREATE INDEX "community_reports_reporter_user_id_created_at_idx" ON "community_reports"("reporter_user_id", "created_at");

-- CreateIndex
CREATE INDEX "community_reports_reviewer_user_id_idx" ON "community_reports"("reviewer_user_id");

-- CreateIndex
CREATE INDEX "community_work_likes_user_id_created_at_idx" ON "community_work_likes"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "community_work_likes_work_id_user_id_key" ON "community_work_likes"("work_id", "user_id");

-- CreateIndex
CREATE INDEX "community_work_favorites_user_id_created_at_idx" ON "community_work_favorites"("user_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "community_work_favorites_work_id_user_id_key" ON "community_work_favorites"("work_id", "user_id");

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_key_binding_id_fkey" FOREIGN KEY ("key_binding_id") REFERENCES "key_bindings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "key_bindings" ADD CONSTRAINT "key_bindings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "runtime_settings" ADD CONSTRAINT "runtime_settings_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_tasks" ADD CONSTRAINT "image_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_tasks" ADD CONSTRAINT "image_tasks_key_binding_id_fkey" FOREIGN KEY ("key_binding_id") REFERENCES "key_bindings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_batches" ADD CONSTRAINT "image_batches_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_batch_items" ADD CONSTRAINT "image_batch_items_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "image_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_batch_items" ADD CONSTRAINT "image_batch_items_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "image_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_assets" ADD CONSTRAINT "image_assets_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "image_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_asset_tags" ADD CONSTRAINT "image_asset_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_asset_tags" ADD CONSTRAINT "image_asset_tags_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "image_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "albums" ADD CONSTRAINT "albums_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_items" ADD CONSTRAINT "album_items_album_id_fkey" FOREIGN KEY ("album_id") REFERENCES "albums"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "album_items" ADD CONSTRAINT "album_items_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "image_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_works" ADD CONSTRAINT "community_works_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_works" ADD CONSTRAINT "community_works_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "image_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_works" ADD CONSTRAINT "community_works_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "image_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "community_works"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_reports" ADD CONSTRAINT "community_reports_reviewer_user_id_fkey" FOREIGN KEY ("reviewer_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_work_likes" ADD CONSTRAINT "community_work_likes_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "community_works"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_work_likes" ADD CONSTRAINT "community_work_likes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_work_favorites" ADD CONSTRAINT "community_work_favorites_work_id_fkey" FOREIGN KEY ("work_id") REFERENCES "community_works"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_work_favorites" ADD CONSTRAINT "community_work_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
