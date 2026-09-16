"use client";

import type { BasemapId } from "./styles";

export default function BasemapToggle({
  value,
  onChange,
}: {
  value: BasemapId;
  onChange: (id: BasemapId) => void;
}) {
  return (
    <div className="no-print absolute bottom-3 left-3 z-10 flex overflow-hidden border border-line bg-paper-raised text-xs uppercase tracking-wide">
      <button
        type="button"
        onClick={() => onChange("streets")}
        className={`px-3 py-1.5 ${value === "streets" ? "bg-copper text-paper" : "hover:bg-copper-soft"}`}
      >
        Plan
      </button>
      <button
        type="button"
        onClick={() => onChange("satellite")}
        className={`px-3 py-1.5 border-l border-line ${value === "satellite" ? "bg-copper text-paper" : "hover:bg-copper-soft"}`}
      >
        Satellite
      </button>
    </div>
  );
}
