import React from "react";

import type { EthicsMetric } from "@/utils/dashboardApi";
import { MetricCard } from "./MetricCard";

export interface EthicsMonitorProps {
  ethicsFlags: EthicsMetric;
  complianceScore: number;
}

const complianceStatus = (score: number): { status: "good" | "warning" | "critical"; label: string } => {
  if (score >= 90) return { status: "good", label: "Strong" };
  if (score >= 75) return { status: "warning", label: "Needs review" };
  return { status: "critical", label: "High risk" };
};

export const EthicsMonitor: React.FC<EthicsMonitorProps> = ({ ethicsFlags, complianceScore }) => {
  const cs = complianceStatus(complianceScore);

  return (
    <div className="card" aria-label="Ethics and compliance">
      <h2>Ethics &amp; Compliance</h2>

      <div className="kpiRow">
        <MetricCard title="Compliance score" value={complianceScore} unit="/100" status={cs.status} subtitle={cs.label} />
        <MetricCard title="Cheating detections" value={ethicsFlags.cheatingDetected} />
        <MetricCard title="Prompt modifications" value={ethicsFlags.promptModifications} />
        <MetricCard title="Privacy alerts" value={ethicsFlags.privacyAlerts} />
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="muted small" style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span>Compliance score</span>
          <span>{complianceScore}/100</span>
        </div>
        <div className="gauge" aria-label={`Compliance score: ${complianceScore}/100`}>
          <div
            style={{
              width: `${Math.max(0, Math.min(100, complianceScore))}%`,
              background:
                cs.status === "good" ? "var(--good)" : cs.status === "warning" ? "var(--warning)" : "var(--critical)"
            }}
          />
        </div>

        <p className="muted small" style={{ marginBottom: 0 }}>
          Alerts are aggregated counts. This dashboard is designed for transparency and system health, not surveillance.
        </p>
      </div>
    </div>
  );
};
