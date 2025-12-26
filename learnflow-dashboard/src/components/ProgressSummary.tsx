import React from "react";

import { MetricCard } from "./MetricCard";

export interface ProgressSummaryProps {
  totalStudents: number;
  averageMastery: number;
  systemHealth: number;
  lastUpdated: string;
}

const healthStatus = (score: number): { status: "good" | "warning" | "critical"; label: string } => {
  if (score >= 85) return { status: "good", label: "Good" };
  if (score >= 70) return { status: "warning", label: "Warning" };
  return { status: "critical", label: "Critical" };
};

export const ProgressSummary: React.FC<ProgressSummaryProps> = ({ totalStudents, averageMastery, systemHealth, lastUpdated }) => {
  const hs = healthStatus(systemHealth);

  return (
    <div className="card" aria-label="Learning progress overview">
      <h2>Learning Progress Overview</h2>

      <div className="kpiRow">
        <MetricCard title="Active students" value={totalStudents} />
        <MetricCard title="Avg mastery" value={averageMastery.toFixed(1)} unit="%" />
        <MetricCard title="System health" value={systemHealth} unit="/100" status={hs.status} subtitle={hs.label} />
        <MetricCard title="Last updated" value={new Date(lastUpdated).toLocaleString()} />
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="muted small" style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span>System health score</span>
          <span>{systemHealth}/100</span>
        </div>
        <div className="gauge" aria-label={`System health: ${systemHealth}/100`}>
          <div style={{ width: `${Math.max(0, Math.min(100, systemHealth))}%`, background: hs.status === "good" ? "var(--good)" : hs.status === "warning" ? "var(--warning)" : "var(--critical)" }} />
        </div>
      </div>
    </div>
  );
};
