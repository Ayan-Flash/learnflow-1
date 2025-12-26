import type { AppProps } from "next/app";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

import "../styles/globals.css";

export type Role = "teacher" | "institution";

interface RoleContextValue {
  role: Role;
  setRole: (role: Role) => void;
}

const RoleContext = createContext<RoleContextValue | null>(null);

export const useRole = (): RoleContextValue => {
  const ctx = useContext(RoleContext);
  if (!ctx) {
    throw new Error("useRole must be used within RoleContext provider");
  }
  return ctx;
};

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean; message?: string }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(err: unknown): { hasError: boolean; message?: string } {
    const message = err instanceof Error ? err.message : "Unexpected error";
    return { hasError: true, message };
  }

  componentDidCatch(err: unknown): void {
    // Error boundary should not throw; this is intentionally minimal for production logs.
    // eslint-disable-next-line no-console
    console.error("Dashboard UI error", err);
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="container">
          <div className="errorBox" role="alert">
            <strong>Something went wrong.</strong>
            <div className="muted" style={{ marginTop: 6 }}>
              {this.state.message}
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App({ Component, pageProps }: AppProps) {
  const [role, setRoleState] = useState<Role>("teacher");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("learnflow-role");
      if (saved === "teacher" || saved === "institution") {
        setRoleState(saved);
      }
    } catch {
      // ignore
    }
  }, []);

  const setRole = useCallback((r: Role) => {
    setRoleState(r);
    try {
      window.localStorage.setItem("learnflow-role", r);
    } catch {
      // ignore
    }
  }, []);

  const value = useMemo(() => ({ role, setRole }), [role, setRole]);

  return (
    <ErrorBoundary>
      <RoleContext.Provider value={value}>
        <Component {...pageProps} />
      </RoleContext.Provider>
    </ErrorBoundary>
  );
}
