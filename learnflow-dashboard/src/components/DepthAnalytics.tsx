import React from "react";
import {
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import type { DepthDistribution, DepthTrendPoint } from "@/utils/dashboardApi";

export interface DepthAnalyticsProps {
  depthDistribution: DepthDistribution;
  progressionTrend: DepthTrendPoint[];
}

const COLORS: Record<keyof DepthDistribution, string> = {
  Core: "#6ea8fe",
  Applied: "#f1c40f",
  Mastery: "#2ecc71"
};

export const DepthAnalytics: React.FC<DepthAnalyticsProps> = ({ depthDistribution, progressionTrend }) => {
  const pieData = (Object.keys(depthDistribution) as Array<keyof DepthDistribution>).map((k) => ({
    name: k,
    value: depthDistribution[k]
  }));

  return (
    <div className="card" aria-label="Depth analytics">
      <h2>Depth Usage Trends</h2>

      <div className="grid" style={{ gap: 18 }}>
        <div className="card" style={{ gridColumn: "span 6" }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
            Depth distribution
          </div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={COLORS[entry.name as keyof DepthDistribution]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: unknown) => (typeof v === "number" ? `${(v * 100).toFixed(1)}%` : v)} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="muted small">Values are normalized shares for the selected period.</div>
        </div>

        <div className="card" style={{ gridColumn: "span 6" }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
            Progression over time
          </div>
          <div style={{ width: "100%", height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={progressionTrend} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
                <XAxis dataKey="timestamp" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} domain={[0, 1]} />
                <Tooltip formatter={(v: unknown) => (typeof v === "number" ? `${(v * 100).toFixed(1)}%` : v)} />
                <Legend />
                <Line type="monotone" dataKey="Core" stroke={COLORS.Core} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Applied" stroke={COLORS.Applied} strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Mastery" stroke={COLORS.Mastery} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {progressionTrend.length === 0 ? (
            <div className="muted small">No depth trend data yet. Send requests with x-anon-student-id to enable progression tracking.</div>
          ) : null}
        </div>
      </div>
    </div>
  );
};
