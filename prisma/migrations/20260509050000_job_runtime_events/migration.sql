CREATE TYPE "JobRuntimeEventType" AS ENUM (
  'queued',
  'running',
  'partial_image',
  'succeeded',
  'failed',
  'canceled',
  'timed_out'
);

CREATE TABLE "job_runtime_events" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "task_id" TEXT NOT NULL,
  "version_node_id" TEXT,
  "type" "JobRuntimeEventType" NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "job_runtime_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "job_runtime_events_user_id_created_at_idx"
  ON "job_runtime_events"("user_id", "created_at");
CREATE INDEX "job_runtime_events_task_id_created_at_idx"
  ON "job_runtime_events"("task_id", "created_at");
CREATE INDEX "job_runtime_events_version_node_id_created_at_idx"
  ON "job_runtime_events"("version_node_id", "created_at");

ALTER TABLE "job_runtime_events"
  ADD CONSTRAINT "job_runtime_events_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_runtime_events"
  ADD CONSTRAINT "job_runtime_events_task_id_fkey"
  FOREIGN KEY ("task_id") REFERENCES "image_tasks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "job_runtime_events"
  ADD CONSTRAINT "job_runtime_events_version_node_id_fkey"
  FOREIGN KEY ("version_node_id") REFERENCES "version_nodes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
