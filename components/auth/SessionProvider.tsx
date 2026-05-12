"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  useCallback
} from "react";
import { getSession, type SessionData } from "@/lib/client/session-api";

export type SessionState =
  | { status: "loading" }
  | { status: "unavailable" }
  | { status: "network_error" }
  | { status: "loaded"; data: SessionData };

export type SessionContextValue = {
  state: SessionState;
  refreshSession: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: "loading" });

  const refreshSession = useCallback(async () => {
    setState({ status: "loading" });
    const result = await getSession();
    if (result.success) {
      setState({ status: "loaded", data: result.data });
    } else {
      if (result.error.code === "auth_store_unavailable") {
        setState({ status: "unavailable" });
      } else {
        setState({ status: "network_error" });
      }
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshSession();
  }, [refreshSession]);

  return (
    <SessionContext.Provider value={{ state, refreshSession }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return context;
}
