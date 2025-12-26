import Head from "next/head";
import { useRouter } from "next/router";
import React, { useEffect, useState } from "react";

import { Navigation } from "@/components/Navigation";
import { MetricCard } from "@/components/MetricCard";
import { getSystemHealth, type SystemHealthMetric } from "@/utils/dashboardApi";

import { useRole } from "./_app";

const statusLabel = (m: SystemHealthMetric): { label: string; cls: string } => {
  if (m.errorRate < 0.01) return { label: "Operational", cls: "statusGood" };
  if (m.errorRate < 0.03) return { label: "Degraded", cls: "statusWarn" };
  return { label: "Unstable", cls: "statusCritical" };
};

export default function HomePage() {
  const router = useRouter();
  const { role, setRole } = useRole();

  const [health, setHealth] = useState<SystemHealthMetric | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getSystemHealth()
      .then((h) => {
        setHealth(h);
        setError(null);
      })
      .catch((e: Error) => {
        setError(e.message);
        setHealth(null);
      });
  }, []);

  return (
    <>
      <Head>
        <title>LearnFlow AI — Dashboard</title>
      </Head>

      <div className="container">
        <Navigation role={role} onRefresh={() => router.reload()} />

        <div className="grid">
          <div className="card" style={{ gridColumn: "span 12" }}>
            <h2>Welcome</h2>
            <p className="muted" style={{ marginTop: 0 }}>
              This dashboard provides transparency into learning patterns and system health. It is not a grading or surveillance tool.
            </p>

            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <button
                type="button"
                className="button primary"
                onClick={() => {
                  setRole("teacher");
                  void router.push("/teacher");
                }}
              >
                Enter Teacher Dashboard
              </button>
              <button
                type="button"
                className="button"
                onClick={() => {
                  setRole("institution");
                  void router.push("/institution");
                }}
              >
                Enter Institution Dashboard
              </button>
            </div>
          </div>

          <div className="card" style={{ gridColumn: "span 12" }}>
            <h2>System status</h2>
            {error ? <div className="errorBox">Unable to reach backend: {error}</div> : null}
            {!error && health ? (
              <>
                <div className="kpiRow" style={{ marginTop: 12 }}>
                  <MetricCard title="Uptime" value={(health.uptime / 3600).toFixed(1)} unit="hours" />
                  <MetricCard title="Avg response" value={health.averageResponseTime.toFixed(1)} unit="ms" />
                  <MetricCard title="Error rate" value={(health.errorRate * 100).toFixed(2)} unit="%" />
                  <MetricCard title="Active errors" value={health.activeBugs} />
                </div>
                <div style={{ marginTop: 12 }}>
                  <span className={`badge ${statusLabel(health).cls}`}>Status: {statusLabel(health).label}</span>
                </div>
              </>
            ) : (
              <div className="muted">Loading…</div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
