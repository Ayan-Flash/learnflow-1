import type { DepthLevel } from "../utils/apiClient";

export function DepthSelector({
  value,
  onChange
}: {
  value: DepthLevel;
  onChange: (v: DepthLevel) => void;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-600">Depth</span>
      <select
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm focus:border-slate-400 focus:outline-none"
        value={value}
        onChange={(e) => onChange(e.target.value as DepthLevel)}
      >
        <option value="Core">Core</option>
        <option value="Applied">Applied</option>
        <option value="Mastery">Mastery</option>
      </select>
    </label>
  );
}
