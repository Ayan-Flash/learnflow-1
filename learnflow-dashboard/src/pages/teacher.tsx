import Head from "next/head";
import React, { useEffect, useMemo, useState } from "react";

import { AssignmentInsights } from "@/components/AssignmentInsights";
import { DepthAnalytics } from "@/components/DepthAnalytics";
import { Navigation } from "@/components/Navigation";
import { ProgressSummary } from "@/components/ProgressSummary";
import { refreshMetrics, getTeacherMetrics, type DashboardPeriod, type TeacherDashboardResponse } from "@/utils/dashboardApi";

import { useRole } from "./_app";

const byMasteryDesc = (a: { masteryLevel: number }, b: { masteryLevel: number }) => b.masteryLevel - a.masteryLevel;

export default function TeacherDashboardPage() {
  const { role, setRole } = useRole();
  const [period, setPeriod] = useState<DashboardPeriod>("week");

  const [data, setData] = useState<TeacherDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (role !== "teacher") setRole("teacher");
  }, [role, setRole]);

  useEffect(() => {
    setLoading(true);
    getTeacherMetrics(period)
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

  const topics = useMemo(() => {
    const list = data ? Object.values(data.metrics.topicBreakdown) : [];
    return list.slice().sort(byMasteryDesc);
  }, [data]);

  return (
    <>
      <Head>
        <title>Teacher Dashboard — LearnFlow AI</title>
      </Head>

      <div className="container">
        <Navigation
          role="teacher"
          onRefresh={() => {
            void refreshMetrics().then(() => {
              setPeriod((p) => p);
            });
            setLoading(true);
            getTeacherMetrics(period)
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
              <h2 style={{ margin: 0 }}>Teacher Dashboard</h2>
              <div className="muted small">Aggregated, anonymized learning trends. No student identities are shown.</div>
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
            <div style={{ gridColumn: "span 12" }}>
              <ProgressSummary
                totalStudents={data.metrics.totalStudents}
                averageMastery={data.metrics.averageMastery}
                systemHealth={data.metrics.systemHealthScore}
                lastUpdated={data.timestamp}
              />
            </div>

            <div className="card" style={{ gridColumn: "span 12" }}>
              <h2>Topic Performance Analysis</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                Topics are ranked by mastery (derived from concept coverage in assignment evaluations). Error frequency reflects low scores or
                off-topic flags.
              </p>
              <div style={{ overflowX: "auto" }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Topic</th>
                      <th>Mastery</th>
                      <th>Attempts</th>
                      <th>Error frequency</th>
                      <th>Last updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topics.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="muted">
                          No topic data yet. Complete a few assignment evaluations to populate this view.
                        </td>
                      </tr>
                    ) : (
                      topics.map((t) => (
                        <tr key={t.topic}>
                          <td>
                            <strong>{t.topic}</strong>
                          </td>
                          <td>{t.masteryLevel.toFixed(1)}%</td>
                          <td>{t.attemptCount}</td>
                          <td>{(t.errorFrequency * 100).toFixed(1)}%</td>
                          <td className="muted">{new Date(t.lastUpdated).toLocaleDateString()}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {data.insights.recommendedInterventions.length > 0 ? (
                <div style={{ marginTop: 12 }}>
                  <h3 style={{ margin: "6px 0", fontSize: 14 }}>Recommended interventions</h3>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {data.insights.recommendedInterventions.slice(0, 6).map((r) => (
                      <li key={r.topic} className="muted" style={{ marginBottom: 6 }}>
                        <strong style={{ color: "var(--text)" }}>{r.topic}</strong> — {r.recommendation} ({r.priority} priority)
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div style={{ gridColumn: "span 12" }}>
              <DepthAnalytics depthDistribution={data.metrics.depthDistribution} progressionTrend={data.metrics.depthTrend} />
            </div>

            <div style={{ gridColumn: "span 12" }}>
              <AssignmentInsights assignmentStats={data.metrics.assignmentStats} period={period} />
            </div>

            <div className="card" style={{ gridColumn: "span 12" }}>
              <h2>Recent Activity</h2>
              <p className="muted" style={{ marginTop: 0 }}>
                A short, anonymized timeline of recent system events.
              </p>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <span className="badge">Ready for Core → Applied: {data.metrics.studentsReadyForAdvancement.CoreToApplied}</span>
                <span className="badge">Ready for Applied → Mastery: {data.metrics.studentsReadyForAdvancement.AppliedToMastery}</span>
                <span className="badge">Time spent (min): Core {data.metrics.timeSpentByDepthMinutes.Core}, Applied {data.metrics.timeSpentByDepthMinutes.Applied}, Mastery {data.metrics.timeSpentByDepthMinutes.Mastery}</span>
              </div>

              <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
                {data.metrics.recentActivity.length === 0 ? (
                  <div className="muted">No recent events.</div>
                ) : (
                  data.metrics.recentActivity.map((e) => (
                    <div key={`${e.timestamp}:${e.summary}`} className="card" style={{ background: "var(--panel-2)", boxShadow: "none" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                        <div>
                          <strong>{e.summary}</strong>
                          {e.topic ? <div className="muted small">Topic: {e.topic}</div> : null}
                        </div>
                        <div className="muted small">{new Date(e.timestamp).toLocaleString()}</div>
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
