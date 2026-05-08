ALTER TABLE "workbench_projects" ADD COLUMN "deleted_at" TIMESTAMP(3);

ALTER TABLE "creative_sessions" ADD COLUMN "deleted_at" TIMESTAMP(3);

ALTER TABLE "version_nodes"
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN "deleted_at" TIMESTAMP(3);

ALTER TABLE "version_nodes" ALTER COLUMN "updated_at" DROP DEFAULT;

CREATE TABLE "workbench_sync_mutations" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "client_mutation_id" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "target_type" TEXT NOT NULL,
  "target_id" TEXT NOT NULL,
  "result" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "workbench_sync_mutations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "workbench_sync_mutations_user_id_client_mutation_id_key"
  ON "workbench_sync_mutations"("user_id", "client_mutation_id");
CREATE INDEX "workbench_sync_mutations_user_id_created_at_idx"
  ON "workbench_sync_mutations"("user_id", "created_at");
CREATE INDEX "workbench_sync_mutations_target_type_target_id_idx"
  ON "workbench_sync_mutations"("target_type", "target_id");
CREATE INDEX "workbench_projects_user_id_deleted_at_idx"
  ON "workbench_projects"("user_id", "deleted_at");
CREATE INDEX "creative_sessions_project_id_deleted_at_idx"
  ON "creative_sessions"("project_id", "deleted_at");
CREATE INDEX "version_nodes_session_id_updated_at_idx"
  ON "version_nodes"("session_id", "updated_at");
CREATE INDEX "version_nodes_project_id_updated_at_idx"
  ON "version_nodes"("project_id", "updated_at");
CREATE INDEX "version_nodes_project_id_deleted_at_idx"
  ON "version_nodes"("project_id", "deleted_at");

ALTER TABLE "workbench_sync_mutations"
  ADD CONSTRAINT "workbench_sync_mutations_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
