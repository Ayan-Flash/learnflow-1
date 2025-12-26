import type { ChatMode } from "../utils/apiClient";

const modes: ChatMode[] = ["Learning", "Assignment Help"];

export function ModeSelector({
  value,
  onChange
}: {
  value: ChatMode;
  onChange: (v: ChatMode) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600">Mode</span>
      <div className="flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm">
        {modes.map((m) => {
          const active = m === value;
          return (
            <button
              key={m}
              type="button"
              onClick={() => onChange(m)}
              className={
                "flex-1 rounded-md px-3 py-2 text-sm transition " +
                (active
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-700 hover:bg-slate-50")
              }
            >
              {m}
            </button>
          );
        })}
      </div>
    </div>
  );
}
