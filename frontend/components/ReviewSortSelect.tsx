"use client";

import { SORT_OPTIONS, type SortValue } from "@/types/review";

type Props = {
  value: SortValue;
  onChange: (value: SortValue) => void;
};

// 口コミの並び替え（#13）。見た目はトップ画面の並び替えと同じ（globals.css の .sort-field）
export default function ReviewSortSelect({ value, onChange }: Props) {
  return (
    <label className="sort-field">
      並び替え
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as SortValue)}
      >
        {SORT_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}
