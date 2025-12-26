export interface AssignmentFeedbackProps {
  title: string;
  ethicalNote: string;
  hints: string[];
  nextSteps: string[];
  conceptualScore?: number;
  strengths?: string[];
  missingConcepts?: string[];
  flags?: string[];
}

export function AssignmentFeedback(props: AssignmentFeedbackProps) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-soft">
      <div className="flex flex-col gap-1">
        <div className="text-sm font-semibold text-slate-900">{props.title}</div>
        <div className="text-xs text-slate-600">{props.ethicalNote}</div>
        {typeof props.conceptualScore === "number" ? (
          <div className="mt-2 text-xs text-slate-600">
            Conceptual score: <span className="font-medium">{Math.round(props.conceptualScore * 100)}%</span>
          </div>
        ) : null}
      </div>

      {props.strengths && props.strengths.length > 0 ? (
        <div className="mt-3">
          <div className="text-xs font-medium text-slate-700">Strengths</div>
          <ul className="mt-1 list-disc pl-5 text-sm text-slate-800">
            {props.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {props.missingConcepts && props.missingConcepts.length > 0 ? (
        <div className="mt-3">
          <div className="text-xs font-medium text-slate-700">Missing / unclear</div>
          <ul className="mt-1 list-disc pl-5 text-sm text-slate-800">
            {props.missingConcepts.slice(0, 6).map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-3">
        <div className="text-xs font-medium text-slate-700">Hints</div>
        <ul className="mt-1 list-disc pl-5 text-sm text-slate-800">
          {props.hints.map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
      </div>

      <div className="mt-3">
        <div className="text-xs font-medium text-slate-700">Next steps</div>
        <ul className="mt-1 list-disc pl-5 text-sm text-slate-800">
          {props.nextSteps.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      </div>

      {props.flags && props.flags.length > 0 ? (
        <div className="mt-3 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">
          <div className="font-medium">Notes</div>
          <div className="mt-1">{props.flags.join(", ")}</div>
        </div>
      ) : null}
    </div>
  );
}
