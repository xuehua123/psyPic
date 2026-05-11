"use client";

import { useEffect, useState, useCallback } from "react";
import { listJobRuntimeEvents } from "./workbench-api";
import type { WorkbenchJobRuntimeEvent } from "./workbench-types";

export type JobRuntimeEventsState = {
  events: WorkbenchJobRuntimeEvent[];
  isLoading: boolean;
  error: { code: string; message: string } | null;
  mode: "ready" | "loading" | "error" | "auth_error" | "fallback";
};

export function useJobRuntimeEvents(options: {
  taskId?: string | null;
  versionNodeId?: string | null;
  autoFetch?: boolean;
}) {
  const { taskId, versionNodeId, autoFetch = true } = options;
  const [state, setState] = useState<JobRuntimeEventsState>({
    events: [],
    isLoading: false,
    error: null,
    mode: "ready"
  });

  const fetchEvents = useCallback(async () => {
    if (!taskId && !versionNodeId) {
      setState(prev => ({ ...prev, events: [], mode: "ready", error: null }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));

    // Fetch up to a reasonable limit for the dock, e.g. 50
    const result = await listJobRuntimeEvents(
      taskId || undefined,
      versionNodeId || undefined,
      undefined,
      50
    );

    if (result.success) {
      setState({
        events: result.data?.items ?? [],
        isLoading: false,
        error: null,
        mode: "ready"
      });
    } else {
      const code = result.error.code;
      let newMode: JobRuntimeEventsState["mode"] = "error";
      
      if (code === "unauthorized" || code === "http_401" || code === "http_403" || code === "forbidden") {
        newMode = "auth_error";
      } else if (code === "network_error" || code === "workbench_store_unavailable" || code === "http_503") {
        newMode = "fallback";
      }

      setState({
        events: [],
        isLoading: false,
        error: result.error,
        mode: newMode
      });
    }
  }, [taskId, versionNodeId]);

  useEffect(() => {
    if (autoFetch) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchEvents();
    }
  }, [fetchEvents, autoFetch]);

  return {
    ...state,
    refresh: fetchEvents
  };
}
