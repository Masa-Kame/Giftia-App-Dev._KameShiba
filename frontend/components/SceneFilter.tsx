"use client";

import { ALL_SCENES, SCENES, type SceneFilterValue } from "@/types/review";

type Props = {
  selected: SceneFilterValue;
  onSelect: (scene: SceneFilterValue) => void;
};

// シーン別絞り込みボタン(#8)
export default function SceneFilter({ selected, onSelect }: Props) {
  const options: SceneFilterValue[] = [ALL_SCENES, ...SCENES];

  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        flexWrap: "wrap",
        marginBottom: "16px",
      }}
    >
      {options.map((scene) => {
        const isActive = selected === scene;
        return (
          <button
            key={scene}
            type="button"
            aria-pressed={isActive}
            onClick={() => onSelect(scene)}
            style={{
              backgroundColor: isActive ? "#2563eb" : "#ffffff",
              color: isActive ? "#ffffff" : "#000000",
              border: "1px solid #ccc",
              borderRadius: "6px",
              padding: "8px 12px",
              cursor: "pointer",
              fontWeight: isActive ? "bold" : "normal",
            }}
          >
            {scene}
          </button>
        );
      })}
    </div>
  );
}
