import Head from "next/head";
import React, { useEffect, useMemo, useState } from "react";

import { EthicsMonitor } from "@/components/EthicsMonitor";
import { MetricCard } from "@/components/MetricCard";
import { Navigation } from "@/components/Navigation";
import { SystemHealth, type HealthTrendData } from "@/components/SystemHealth";
import {
  refreshMetrics,
  getInstitutionMetrics,
  type DashboardPeriod,
  type InstitutionDashboardResponse
} from "@/utils/dashboardApi";

import { useRole } from "./_app";

export default function InstitutionDashboardPage() {
  const { role, setRole } = useRole();
  const [period, setPeriod] = useState<DashboardPeriod>("month");

  const [data, setData] = useState<InstitutionDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (role !== "institution") setRole("institution");
  }, [role, setRole]);

  useEffect(() => {
    setLoading(true);
    getInstitutionMetrics(period)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch((e: Error) => {
        setError(e.message);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [period]);

  const historical: HealthTrendData[] = useMemo(() => {
    return [];
  }, []);

  const complianceScore = useMemo(() => {
    if (!data) return 0;
    const e = data.metrics.ethicsFlags;
    const interactions = Math.max(1, data.metrics.usage.totalInteractions);
    const severity = e.cheatingDetected * 2 + e.privacyAlerts * 3 + e.assignmentEnforcements + e.promptModifications;
    const score = 100 - Math.min(100, (severity / interactions) * 200);
    return Math.max(0, Math.min(100, Math.round(score)));
  }, [data]);

  return (
    <>
      <Head>
        <title>Institution Dashboard — LearnFlow AI</title>
      </Head>

      <div className="container">
        <Navigation
          role="institution"
          onRefresh={() => {
            void refreshMetrics().then(() => undefined);
            setLoading(true);
            getInstitutionMetrics(period)
              .then((d) => {
                setData(d);
                setError(null);
              })
              .catch((e: Error) => {
                setError(e.message);
                setData(null);
              })
              .finally(() => setLoading(false));
          }}
        />

        <div className="card" style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div>
              <h2 style={{ margin: 0 }}>Institution Dashboard</h2>
              <div className="muted small">Audit-oriented metrics for AI usage patterns, quality, and compliance.</div>
            </div>
            <label className="muted small" style={{ display: "flex", alignItems: "center", gap: 10 }}>
              Period
              <select
                className="button"
                value={period}
                onChange={(e) => setPeriod(e.target.value as DashboardPeriod)}
                aria-label="Select period"
              >
                <option value="day">Day</option>
                <option value="week">Week</option>
                <option value="month">Month</option>
              </select>
            </label>
          </div>
        </div>

        {loading ? <div className="muted">Loading…</div> : null}
        {error ? (
          <div className="errorBox" role="alert">
            {error}
          </div>
        ) : null}

        {!loading && !error && data ? (
          <div className="grid">
            <div className="card" style={{ gridColumn: "span 12" }}>
              <h2>AI Usage Analytics</h2>
              <div className="kpiRow">
                <MetricCard title="Total interactions" value={data.metrics.usage.totalInteractions} />
                <MetricCard title="Gemini API calls" value={data.metrics.usage.geminiApiCalls} />
                <MetricCard title="Estimated Gemini cost" value={data.metrics.usage.estimatedGeminiCostUsd.toFixed(2)} unit="USD" />
                <MetricCard title="P95 latency" value={data.metrics.usage.p95ResponseTimeMs.toFixed(1)} unit="ms" />
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span className="badge">Avg latency: {data.metrics.usage.averageResponseTimeMs.toFixed(1)}ms</span>
                <span className="badge">Error rate: {(data.metrics.usage.errorRate * 100).toFixed(2)}%</span>
              </div>
            </div>

            <div style={{ gridColumn: "span 12" }}>
              <EthicsMonitor ethicsFlags={data.metrics.ethicsFlags} complianceScore={complianceScore} />
            </div>

            <div className="card" style={{ gridColumn: "span 12" }}>
              <h2>Quality Metrics</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                Quality is computed from interaction telemetry (depth alignment and clarity) and tracked over time.
              </p>

              <div className="kpiRow">
                <MetricCard title="Depth alignment" value={data.metrics.qualityScores.depthAlignmentScore.toFixed(3)} />
                <MetricCard title="Clarity score" value={data.metrics.qualityScores.clarityScore.toFixed(3)} />
                <MetricCard title="Reasoning quality" value={data.metrics.qualityScores.reasoningQualityAverage.toFixed(3)} />
                <MetricCard title="Trend" value={data.metrics.qualityScores.trend} />
              </div>
            </div>

            <div style={{ gridColumn: "span 12" }}>
              <SystemHealth healthMetric={data.metrics.systemHealth} historicalData={historical} />
            </div>

            <div className="card" style={{ gridColumn: "span 12" }}>
              <h2>System Health — Modules</h2>
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Module</th>
                      <th>Requests</th>
                      <th>Error rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.metrics.systemHealth.modules.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="muted">
                          No module-level data yet.
                        </td>
                      </tr>
                    ) : (
                      data.metrics.systemHealth.modules.map((m) => (
                        <tr key={m.module}>
                          <td>
                            <strong>{m.module}</strong>
                          </td>
                          <td>{m.count}</td>
                          <td>{(m.errorRate * 100).toFixed(2)}%</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span className="badge">Telemetry writable: {data.metrics.pipeline.telemetryWritable ? "Yes" : "No"}</span>
                <span className="badge">W&B enabled: {data.metrics.pipeline.wandbEnabled ? "Yes" : "No"}</span>
              </div>
            </div>

            <div className="card" style={{ gridColumn: "span 12" }}>
              <h2>Recent Alerts</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                Events shown are aggregated system health and compliance signals.
              </p>

              <div style={{ display: "grid", gap: 10 }}>
                {data.metrics.recentAlerts.length === 0 ? (
                  <div className="muted">No recent alerts.</div>
                ) : (
                  data.metrics.recentAlerts.map((a) => (
                    <div key={`${a.timestamp}:${a.message}`} className="card" style={{ background: "var(--panel-2)", boxShadow: "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div>
                          <strong>{a.message}</strong>
                          {a.module ? <div className="muted small">Module: {a.module}</div> : null}
                        </div>
                        <div className="muted small">{new Date(a.timestamp).toLocaleString()}</div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
