import React from "react";

import type { AssignmentStatistic, DashboardPeriod } from "@/utils/dashboardApi";

export interface AssignmentInsightsProps {
  assignmentStats: AssignmentStatistic[];
  period: DashboardPeriod;
}

const topMisconceptions = (mis: Record<string, number>, n = 2): string => {
  const entries = Object.entries(mis).sort((a, b) => b[1] - a[1]).slice(0, n);
  if (entries.length === 0) return "—";
  return entries.map(([k, v]) => `${k} (${v})`).join(", ");
};

export const AssignmentInsights: React.FC<AssignmentInsightsProps> = ({ assignmentStats, period }) => {
  const sorted = assignmentStats.slice().sort((a, b) => b.evaluatedCount - a.evaluatedCount);

  return (
    <div className="card" aria-label="Assignment effectiveness">
      <h2>Assignment Effectiveness</h2>
      <p className="muted" style={{ marginTop: 0 }}>
        Summary for <strong>{period}</strong>.
      </p>

      <div style={{ overflowX: "auto" }}>
        <table className="table">
          <thead>
            <tr>
              <th>Topic</th>
              <th>Generated</th>
              <th>Evaluated</th>
              <th>Avg score</th>
              <th>Avg hints</th>
              <th>Top misconceptions</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={6} className="muted">
                  No assignment activity recorded yet.
                </td>
              </tr>
            ) : (
              sorted.map((s) => (
                <tr key={s.topic}>
                  <td>
                    <strong>{s.topic}</strong>
                    <div className="muted small">Updated: {new Date(s.lastUpdated).toLocaleDateString()}</div>
                  </td>
                  <td>{s.generatedCount}</td>
                  <td>{s.evaluatedCount}</td>
                  <td>{s.averageScore.toFixed(1)}%</td>
                  <td>{s.hintEffectiveness.averageHintsProvided.toFixed(2)}</td>
                  <td className="muted">{topMisconceptions(s.misconceptionCounts, 2)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="muted small" style={{ marginTop: 10 }}>
        Scores are based on rubric concept coverage (not grading). Hints reflect feedback density and are used only to assess learning support quality.
      </div>
    </div>
  );
};
