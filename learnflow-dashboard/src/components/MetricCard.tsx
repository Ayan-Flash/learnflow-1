import React from "react";

export type MetricTrend = "up" | "down" | "stable";
export type MetricStatus = "good" | "warning" | "critical";

export interface MetricCardProps {
  title: string;
  value: number | string;
  unit?: string;
  trend?: MetricTrend;
  status?: MetricStatus;
  subtitle?: string;
}

const trendLabel = (trend?: MetricTrend): string | null => {
  if (!trend) return null;
  if (trend === "up") return "Improving";
  if (trend === "down") return "Declining";
  return "Stable";
};

const statusClass = (status?: MetricStatus): string => {
  if (status === "warning") return "statusWarn";
  if (status === "critical") return "statusCritical";
  return "statusGood";
};

export const MetricCard: React.FC<MetricCardProps> = ({ title, value, unit, trend, status, subtitle }) => {
  const t = trendLabel(trend);

  return (
    <div className="card" role="group" aria-label={title}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "baseline" }}>
        <div>
          <div className="muted" style={{ fontSize: 12, fontWeight: 600 }}>
            {title}
          </div>
          {subtitle ? (
            <div className="muted" style={{ fontSize: 12, marginTop: 3 }}>
              {subtitle}
            </div>
          ) : null}
        </div>
        {t ? (
          <span className={`badge ${statusClass(status)}`} aria-label={`Trend: ${t}`}>
            {t}
          </span>
        ) : null}
      </div>

      <div style={{ marginTop: 10, fontSize: 26, fontWeight: 700, letterSpacing: -0.3 }}>
        {value}
        {unit ? <span className="muted" style={{ fontSize: 14, marginLeft: 6 }}>
          {unit}
        </span> : null}
      </div>
    </div>
  );
};
