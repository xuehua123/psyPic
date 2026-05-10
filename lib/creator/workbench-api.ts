import { fetchApi } from "@/lib/client/api-result";
import type {
  WorkbenchProject,
  WorkbenchSession,
  WorkbenchVersionNode,
  WorkbenchJobRuntimeEvent,
  WorkbenchPage,
  WorkbenchSyncPushRequest,
  WorkbenchSyncPushResponse,
  WorkbenchSyncPullResponse
} from "./workbench-types";

// --- Projects ---

export function listProjects(cursor?: string, limit?: number) {
  const params = new URLSearchParams();
  if (cursor) params.set("cursor", cursor);
  if (limit) params.set("limit", String(limit));
  const qs = params.toString();
  return fetchApi<WorkbenchPage<WorkbenchProject>>(
    `/api/workbench/projects${qs ? `?${qs}` : ""}`
  );
}

export function createProject(data: {
  title: string;
  sort_order?: number;
  collapsed?: boolean;
  active_session_id?: string | null;
}) {
  return fetchApi<WorkbenchProject>("/api/workbench/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data)
  });
}

export function updateProject(id: string, data: {
  title?: string;
  sort_order?: number;
  collapsed?: boolean;
  active_session_id?: string | null;
}) {
  return fetchApi<WorkbenchProject>(`/api/workbench/projects/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data)
  });
}

export function deleteProject(id: string) {
  return fetchApi<WorkbenchProject>(`/api/workbench/projects/${id}`, {
    method: "DELETE"
  });
}

// --- Sessions ---

export function listSessions(projectId: string, cursor?: string, limit?: number) {
  const params = new URLSearchParams();
  params.set("project_id", projectId);
  if (cursor) params.set("cursor", cursor);
  if (limit) params.set("limit", String(limit));
  const qs = params.toString();
  return fetchApi<WorkbenchPage<WorkbenchSession>>(
    `/api/workbench/sessions?${qs}`
  );
}

export function createSession(data: {
  project_id: string;
  title: string;
  fork_parent_version_node_id?: string | null;
  active_version_node_id?: string | null;
  custom_label?: string | null;
  is_pinned?: boolean;
  is_archived?: boolean;
}) {
  return fetchApi<WorkbenchSession>("/api/workbench/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data)
  });
}

export function updateSession(id: string, data: {
  title?: string;
  fork_parent_version_node_id?: string | null;
  active_version_node_id?: string | null;
  custom_label?: string | null;
  is_pinned?: boolean;
  is_archived?: boolean;
  last_read_at?: string | null;
}) {
  return fetchApi<WorkbenchSession>(`/api/workbench/sessions/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data)
  });
}

export function deleteSession(id: string) {
  return fetchApi<WorkbenchSession>(`/api/workbench/sessions/${id}`, {
    method: "DELETE"
  });
}

// --- Version Nodes ---

export function listVersionNodes(sessionId: string, cursor?: string, limit?: number) {
  const params = new URLSearchParams();
  params.set("session_id", sessionId);
  if (cursor) params.set("cursor", cursor);
  if (limit) params.set("limit", String(limit));
  const qs = params.toString();
  return fetchApi<WorkbenchPage<WorkbenchVersionNode>>(
    `/api/workbench/version-nodes?${qs}`
  );
}

export function createVersionNode(data: {
  project_id: string;
  session_id: string;
  parent_version_node_id?: string | null;
  prompt_snapshot: string;
  params_snapshot: unknown;
  source_asset_ids?: string[];
  output_asset_ids?: string[];
  board_document_id?: string | null;
  board_snapshot?: unknown | null;
  board_export_asset_id?: string | null;
  branch_label?: string | null;
  status?: string;
}) {
  return fetchApi<WorkbenchVersionNode>("/api/workbench/version-nodes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data)
  });
}

export function updateVersionNode(id: string, data: {
  status?: string;
  output_asset_ids?: string[];
  branch_label?: string | null;
  board_document_id?: string | null;
  board_snapshot?: unknown | null;
  board_export_asset_id?: string | null;
}) {
  return fetchApi<WorkbenchVersionNode>(`/api/workbench/version-nodes/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data)
  });
}

export function deleteVersionNode(id: string) {
  return fetchApi<WorkbenchVersionNode>(`/api/workbench/version-nodes/${id}`, {
    method: "DELETE"
  });
}

// --- Sync ---

export function pullWorkbenchChanges(updatedSince?: string) {
  const params = new URLSearchParams();
  if (updatedSince) params.set("updated_since", updatedSince);
  const qs = params.toString();
  return fetchApi<WorkbenchSyncPullResponse>(
    `/api/workbench/sync${qs ? `?${qs}` : ""}`
  );
}

export function pushWorkbenchChanges(data: WorkbenchSyncPushRequest) {
  return fetchApi<WorkbenchSyncPushResponse>("/api/workbench/sync", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(data)
  });
}

// --- Job Runtime Events ---

export function listJobRuntimeEvents(
  taskId?: string,
  versionNodeId?: string,
  cursor?: string,
  limit?: number
) {
  const params = new URLSearchParams();
  if (taskId) params.set("task_id", taskId);
  if (versionNodeId) params.set("version_node_id", versionNodeId);
  if (cursor) params.set("cursor", cursor);
  if (limit) params.set("limit", String(limit));
  const qs = params.toString();
  return fetchApi<WorkbenchPage<WorkbenchJobRuntimeEvent>>(
    `/api/workbench/job-runtime-events${qs ? `?${qs}` : ""}`
  );
}
