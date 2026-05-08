-- CreateEnum
CREATE TYPE "VersionNodeStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'canceled', 'timed_out', 'partial_image');

-- AlterEnum
ALTER TYPE "ImageTaskStatus" ADD VALUE 'timed_out';

-- AlterTable
ALTER TABLE "image_tasks" ADD COLUMN     "project_id" TEXT,
ADD COLUMN     "session_id" TEXT,
ADD COLUMN     "version_node_id" TEXT;

-- CreateTable
CREATE TABLE "workbench_projects" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "collapsed" BOOLEAN NOT NULL DEFAULT false,
    "active_session_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workbench_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "creative_sessions" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "fork_parent_version_node_id" TEXT,
    "active_version_node_id" TEXT,
    "custom_label" TEXT,
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "last_read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "creative_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "version_nodes" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "parent_version_node_id" TEXT,
    "prompt_snapshot" TEXT NOT NULL,
    "params_snapshot" JSONB NOT NULL,
    "source_asset_ids" JSONB NOT NULL,
    "output_asset_ids" JSONB NOT NULL,
    "board_document_id" TEXT,
    "board_snapshot" JSONB,
    "board_export_asset_id" TEXT,
    "branch_label" TEXT,
    "status" "VersionNodeStatus" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "version_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "workbench_projects_user_id_sort_order_idx" ON "workbench_projects"("user_id", "sort_order");

-- CreateIndex
CREATE INDEX "workbench_projects_user_id_updated_at_idx" ON "workbench_projects"("user_id", "updated_at");

-- CreateIndex
CREATE INDEX "creative_sessions_project_id_updated_at_idx" ON "creative_sessions"("project_id", "updated_at");

-- CreateIndex
CREATE INDEX "creative_sessions_project_id_is_pinned_updated_at_idx" ON "creative_sessions"("project_id", "is_pinned", "updated_at");

-- CreateIndex
CREATE INDEX "version_nodes_session_id_created_at_idx" ON "version_nodes"("session_id", "created_at");

-- CreateIndex
CREATE INDEX "version_nodes_project_id_created_at_idx" ON "version_nodes"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "version_nodes_parent_version_node_id_idx" ON "version_nodes"("parent_version_node_id");

-- CreateIndex
CREATE UNIQUE INDEX "image_tasks_version_node_id_key" ON "image_tasks"("version_node_id");

-- CreateIndex
CREATE INDEX "image_tasks_project_id_created_at_idx" ON "image_tasks"("project_id", "created_at");

-- CreateIndex
CREATE INDEX "image_tasks_session_id_created_at_idx" ON "image_tasks"("session_id", "created_at");

-- AddForeignKey
ALTER TABLE "image_tasks" ADD CONSTRAINT "image_tasks_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "workbench_projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_tasks" ADD CONSTRAINT "image_tasks_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "creative_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "image_tasks" ADD CONSTRAINT "image_tasks_version_node_id_fkey" FOREIGN KEY ("version_node_id") REFERENCES "version_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workbench_projects" ADD CONSTRAINT "workbench_projects_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "creative_sessions" ADD CONSTRAINT "creative_sessions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "workbench_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_nodes" ADD CONSTRAINT "version_nodes_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "workbench_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_nodes" ADD CONSTRAINT "version_nodes_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "creative_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "version_nodes" ADD CONSTRAINT "version_nodes_parent_version_node_id_fkey" FOREIGN KEY ("parent_version_node_id") REFERENCES "version_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
