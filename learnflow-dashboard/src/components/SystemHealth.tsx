import React from "react";
import { Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import type { SystemHealthMetric } from "@/utils/dashboardApi";
import { MetricCard } from "./MetricCard";

export interface HealthTrendData {
  timestamp: string;
  averageResponseTime: number;
  errorRate: number;
}

export interface SystemHealthProps {
  healthMetric: SystemHealthMetric;
  historicalData: HealthTrendData[];
}

const statusFromErrorRate = (errorRate: number): "good" | "warning" | "critical" => {
  if (errorRate < 0.01) return "good";
  if (errorRate < 0.03) return "warning";
  return "critical";
};

export const SystemHealth: React.FC<SystemHealthProps> = ({ healthMetric, historicalData }) => {
  const status = statusFromErrorRate(healthMetric.errorRate);
  const uptimeHours = (healthMetric.uptime / 3600).toFixed(1);

  return (
    <div className="card" aria-label="System health">
      <h2>System Health</h2>

      <div className="kpiRow">
        <MetricCard title="Uptime" value={uptimeHours} unit="hours" status="good" />
        <MetricCard title="Avg response" value={healthMetric.averageResponseTime.toFixed(1)} unit="ms" status={status} />
        <MetricCard title="Error rate" value={(healthMetric.errorRate * 100).toFixed(2)} unit="%" status={status} />
        <MetricCard title="Active errors" value={healthMetric.activeBugs} status={status} />
      </div>

      <div style={{ marginTop: 14 }}>
        <div className="muted small" style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span>Reliability</span>
          <span>{(100 - healthMetric.errorRate * 100).toFixed(1)}%</span>
        </div>
        <div className="gauge" aria-label={`Reliability ${(100 - healthMetric.errorRate * 100).toFixed(1)}%`}>
          <div
            style={{
              width: `${Math.max(0, Math.min(100, 100 - healthMetric.errorRate * 100))}%`,
              background: status === "good" ? "var(--good)" : status === "warning" ? "var(--warning)" : "var(--critical)"
            }}
          />
        </div>
      </div>

      <div style={{ marginTop: 14, width: "100%", height: 260 }}>
        <ResponsiveContainer>
          <LineChart data={historicalData} margin={{ top: 10, right: 12, left: 0, bottom: 10 }}>
            <XAxis dataKey="timestamp" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="left" tick={{ fontSize: 11 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} domain={[0, 0.2]} />
            <Tooltip
              formatter={(v: unknown, name: string) => {
                if (typeof v !== "number") return [String(v), name];
                if (name === "errorRate") return [`${(v * 100).toFixed(2)}%`, "errorRate"];
                return [`${v.toFixed(1)}ms`, "avgResponse"];
              }}
            />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="averageResponseTime" name="avgResponse" stroke="#6ea8fe" dot={false} />
            <Line yAxisId="right" type="monotone" dataKey="errorRate" name="errorRate" stroke="#e74c3c" dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {historicalData.length === 0 ? (
        <div className="muted small">Historical health trends are not available yet in this deployment.</div>
      ) : null}
    </div>
  );
};
