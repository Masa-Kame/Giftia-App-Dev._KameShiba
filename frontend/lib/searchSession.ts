// lib/searchSession.ts — 検索画面の状態を、ブラウザのタブ内（sessionStorage）に一時保存する
// 商品詳細から戻ったときに、検索条件・検索結果・スクロール位置を元に戻すために使う
// ・タブを閉じると消える（別タブ・別の人には共有されない）
// ・保存や読み込みに失敗しても画面は普通に動くよう、すべて try/catch で包む
import { useSyncExternalStore } from "react";
import type { Gift, SearchCondition } from "./api";

const STORAGE_KEY = "giftia:search";

// 検索フォームの入力内容（StandardSearch の状態と同じ項目）
export type SavedSearchForm = {
  mode: "simple" | "recommended";
  keyword: string;
  categories: string[];
  scene: string;
  giftPolicy: string;
  sort: string;
  popularityPeriod: string;
  priceMin: number;
  priceMax: number;
  preferences: string[];
  gender: string;
  age: string;
};

export type SavedSearch = {
  form?: SavedSearchForm; // フォームの入力内容
  condition?: SearchCondition; // 最後に検索した条件（並び替え・期間の変更で再検索に使う）
  results?: Gift[] | null; // 検索結果（null は結果なし＝検索前の表示）
  scrollY?: number; // 商品を開いたときのスクロール位置
};

export function loadSavedSearch(): SavedSearch | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedSearch) : null;
  } catch {
    return null;
  }
}

function updateSavedSearch(changes: Partial<SavedSearch>) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ...loadSavedSearch(), ...changes }));
  } catch {
    // 保存できなくても検索自体は動く（戻ったときに復元されないだけ）
  }
}

export function saveSearchForm(form: SavedSearchForm, condition: SearchCondition) {
  updateSavedSearch({ form, condition });
}

export function saveSearchResults(results: Gift[] | null) {
  updateSavedSearch({ results });
}

export function saveSearchScroll(scrollY: number) {
  updateSavedSearch({ scrollY });
}

// 条件クリア・モード切り替え・トップへ戻るときに、保存した状態を消す
export function clearSavedSearch() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // 消せなくても画面は動く
  }
}

function hasSavedSearchResults(): boolean {
  return Array.isArray(loadSavedSearch()?.results);
}

const subscribeNothing = () => () => {};

// ブラウザで動いているか（サーバーで描画している間は false）。
// sessionStorage はブラウザにしかないので、読んだ結果を画面に出す前にこれで確かめる（表示のずれ＝hydration エラー防止）
export function useIsClient(): boolean {
  return useSyncExternalStore(subscribeNothing, () => true, () => false);
}

// 戻れる検索結果があるか（商品詳細の「検索結果に戻る」の表示に使う）
export function useHasSavedSearchResults(): boolean {
  return useSyncExternalStore(subscribeNothing, hasSavedSearchResults, () => false);
}
