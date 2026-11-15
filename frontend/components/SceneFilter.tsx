"use client";

import {
  ALL_SCENES,
  SCENES,
  type Scene,
  type SceneFilterValue,
} from "@/types/review";
import styles from "./review.module.css";

type Props = {
  selected: SceneFilterValue;
  onSelect: (scene: SceneFilterValue) => void;
  counts: Record<Scene, number> | null; // シーンごとの件数（読み込み前は null）
  allCount: number | null; // すべての件数（読み込み前は null）
};

// シーン別絞り込みボタン（#8）。トップ画面のタグと同じ見た目（globals.css の .preference-tag）
// ボタンに口コミの件数を表示し、0件のシーンは押せないようにする
export default function SceneFilter({ selected, onSelect, counts, allCount }: Props) {
  const options: SceneFilterValue[] = [ALL_SCENES, ...SCENES];

  const countOf = (scene: SceneFilterValue): number | null => {
    if (scene === ALL_SCENES) return allCount;
    return counts ? counts[scene] : null;
  };

  return (
    <div className="preference-tags">
      {options.map((scene) => {
        const isActive = selected === scene;
        const count = countOf(scene);
        const isEmpty = count === 0 && !isActive; // 0件のシーンは押せない

        const className = [
          "preference-tag",
          isActive ? "selected" : "",
          isEmpty ? styles.chipDisabled : "",
        ]
          .filter(Boolean)
          .join(" ");

        return (
          <button
            key={scene}
            type="button"
            className={className}
            aria-pressed={isActive}
            aria-label={count === null ? scene : `${scene}（${count}件）`}
            disabled={isEmpty}
            onClick={() => onSelect(scene)}
          >
            <span aria-hidden="true">#</span>
            <span>{scene}</span>
            {count !== null && <span className="preference-count">{count}</span>}
          </button>
        );
      })}
    </div>
  );
}
