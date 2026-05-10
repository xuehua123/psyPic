export type WorkbenchProject = {
  id: string;
  user_id: string;
  title: string;
  sort_order: number;
  collapsed: boolean;
  active_session_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type WorkbenchSession = {
  id: string;
  project_id: string;
  title: string;
  fork_parent_version_node_id: string | null;
  active_version_node_id: string | null;
  custom_label: string | null;
  is_pinned: boolean;
  is_archived: boolean;
  last_read_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type WorkbenchVersionNodeStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "canceled"
  | "timed_out"
  | "partial_image";

export type WorkbenchVersionNode = {
  id: string;
  project_id: string;
  session_id: string;
  parent_version_node_id: string | null;
  prompt_snapshot: string;
  params_snapshot: unknown;
  source_asset_ids: string[];
  output_asset_ids: string[];
  board_document_id: string | null;
  board_snapshot: unknown | null;
  board_export_asset_id: string | null;
  branch_label: string | null;
  status: WorkbenchVersionNodeStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

export type WorkbenchJobRuntimeEventType =
  | "queued"
  | "running"
  | "partial_image"
  | "succeeded"
  | "failed"
  | "canceled"
  | "timed_out";

export type WorkbenchJobRuntimeEvent = {
  id: string;
  user_id: string;
  task_id: string;
  version_node_id: string | null;
  type: WorkbenchJobRuntimeEventType;
  payload: unknown;
  created_at: string;
};

export type WorkbenchPage<T> = {
  items: T[];
  next_cursor: string | null;
};

export type WorkbenchSyncPullResponse = {
  projects: WorkbenchProject[];
  sessions: WorkbenchSession[];
  version_nodes: WorkbenchVersionNode[];
  last_sync_time?: string;
};

export type WorkbenchSyncOperation = {
  client_mutation_id: string;
  entity: "project" | "session" | "version_node";
  action: "upsert" | "delete";
  data: Record<string, unknown>;
};

export type WorkbenchSyncPushRequest = {
  operations: WorkbenchSyncOperation[];
  pull?: {
    updated_since: string;
  };
};

export type WorkbenchSyncResult = {
  client_mutation_id: string;
  entity: "project" | "session" | "version_node";
  action: "upsert" | "delete";
  id: string;
  status: "applied" | "replayed" | "conflict" | "error";
  record?: WorkbenchProject | WorkbenchSession | WorkbenchVersionNode;
  server_record?: WorkbenchProject | WorkbenchSession | WorkbenchVersionNode;
  code?: string;
  message?: string;
};

export type WorkbenchSyncPushResponse = {
  push_results: WorkbenchSyncResult[];
  pulled?: WorkbenchSyncPullResponse;
};
