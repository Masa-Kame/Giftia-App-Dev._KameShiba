"use client";

import { useRef, useState, type CSSProperties, type FormEvent } from "react";
import type { SearchCondition } from "@/lib/api";

const CATEGORIES = ["食品", "飲料", "コスメ", "インテリア", "カタログギフト", "ビジネス小物", "フラワー", "家電", "酒類", "生活雑貨"];
const SCENES = ["送別", "誕生日", "お祝い", "取引先へのお礼", "母の日", "お歳暮", "お中元", "結婚祝い", "父の日", "出産祝い"];
const SORTS = ["おすすめ順", "人気順", "評価順", "価格の安い順", "新着順"];
// 選択肢はこの配列に追加できる。その他も独立した選択肢として管理する。
const PREFERENCES = ["旅行好き", "グルメ好き", "美容好き", "ガジェット好き", "植物・花好き", "シンプル好き", "その他の好み"];
const GENDERS = ["指定なし", "男性", "女性"];
const AGES = ["指定なし", "20代", "30代", "40代", "50代", "60代以上"];
const PRICE_MIN = 500;
const PRICE_MAX = 30000;
const ICON_PATHS: Record<string, string> = {
  search: "M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  reset: "M3 10a9 9 0 1 1 2 9M3 4v6h6",
  travel: "M5 7h14a2 2 0 0 1 2 2v11H3V9a2 2 0 0 1 2-2ZM9 7V4h6v3M8 7v13M16 7v13",
  food: "M4 3v6a3 3 0 0 0 6 0V3M7 3v19M19 22V3c-4 2-5 7-3 10h3",
  beauty: "M9 7V3h6v4M8 10h8l2 11H6l2-11ZM10 7h4v3h-4",
  gadget: "M5 3h14v13H5ZM2 20l3-4h14l3 4H2ZM10 18h4",
  flower: "M12 9c-7-11-14 1-4 4-9 7 4 14 5 4 8 8 15-4 5-6 5-10-9-12-6-2ZM14 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0",
  heart: "M12 21 3 12C-3 4 7-2 12 6c5-8 15-2 9 6l-9 9Z",
  more: "M4 12h.01M12 12h.01M20 12h.01",
};
const PREFERENCE_ICONS = ["travel", "food", "beauty", "gadget", "flower", "heart", "more"];
function SearchIcon({ name }: { name: string }) {
  return <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON_PATHS[name]} /></svg>;
}
const toggle = (current: string[], value: string) => current.includes(value)
  ? current.filter((item) => item !== value) : [...current, value];

export default function StandardSearch({ onSearch }: {
  onSearch: (condition: SearchCondition) => Promise<void>;
}) {
  const [keyword, setKeyword] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [scene, setScene] = useState("");
  const [sort, setSort] = useState("人気順");
  const [priceMin, setPriceMin] = useState(PRICE_MIN);
  const [priceMax, setPriceMax] = useState(PRICE_MAX);
  const [preferences, setPreferences] = useState<string[]>([]);
  const [gender, setGender] = useState("指定なし");
  const [age, setAge] = useState("指定なし");
  const [advancedOpen, setAdvancedOpen] = useState(true);
  const categoryDropdown = useRef<HTMLDetailsElement>(null);
  const [pending, setPending] = useState(false);

  function clear() {
    setKeyword(""); setCategories([]); setScene(""); setSort("人気順");
    setPriceMin(PRICE_MIN); setPriceMax(PRICE_MAX); setPreferences([]);
    setGender("指定なし"); setAge("指定なし");
    setAdvancedOpen(true);
    if (categoryDropdown.current) categoryDropdown.current.open = false;
  }

  function updateMinPrice(value: string) {
    setPriceMin(Math.max(PRICE_MIN, Math.min(Number(value), priceMax)));
  }

  function updateMaxPrice(value: string) {
    setPriceMax(Math.min(PRICE_MAX, Math.max(Number(value), priceMin)));
  }

  const priceLabel = `${priceMin.toLocaleString("ja-JP")}円 〜 ${priceMax === PRICE_MAX ? "上限なし" : `${priceMax.toLocaleString("ja-JP")}円`}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const maxPrice = priceMax === PRICE_MAX ? undefined : priceMax;
    console.log("検索条件", { keyword, categories, scene, sort, priceMin,
      priceMax: maxPrice ?? null, preferences, gender, age });
    if (categoryDropdown.current) categoryDropdown.current.open = false;
    setPending(true);
    try {
      // 未対応条件は送らず、既存のAPI契約を維持する。
      await onSearch({ keyword, category: categories.length === 1 ? categories[0] : "",
        indivWrap: false, priceBand: "", priceMin, priceMax: maxPrice });
    } finally {
      setPending(false);
    }
  }

  return (
    <form className="standard-search" onSubmit={submit}>
      <p className="search-intro">いまの Giftia の検索（キーワード・カテゴリー・価格帯で探す）</p>
      <label className="keyword-field">
        <span className="visually-hidden">キーワード</span>
        <SearchIcon name="search" />
        <input type="search" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="キーワード（例：送別 お菓子）" />
      </label>

      <div className="search-selects">
        <div className="category-dropdown">
          <span id="category-label" className="field-caption">カテゴリー</span>
          <details ref={categoryDropdown} onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.currentTarget.open = false;
            e.currentTarget.querySelector("summary")?.focus();
          }
        }}>
          <summary className="dropdown-trigger" aria-controls="category-options" aria-labelledby="category-label category-value">
            <span id="category-value">{categories.length === 0 ? "すべてのカテゴリー" : categories.length === 1 ? categories[0] : `${categories.length}件選択中`}</span>
            <span aria-hidden="true">⌄</span>
          </summary>
          <fieldset id="category-options" className="dropdown-options">
            <legend className="visually-hidden">カテゴリー（複数選択可）</legend>
            {CATEGORIES.map((category) => <label key={category}>
              <input type="checkbox" checked={categories.includes(category)} onChange={() => setCategories((current) => toggle(current, category))} />{category}
            </label>)}
          </fieldset>
          </details>
        </div>
        <label><span className="field-caption">シーン</span>
          <select value={scene} onChange={(e) => setScene(e.target.value)}>
            <option value="">すべてのシーン</option>
            {SCENES.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
        <label className="sort-field"><span className="field-caption"><span aria-hidden="true">⇅</span> 並び替え</span>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            {SORTS.map((value) => <option key={value}>{value}</option>)}
          </select>
        </label>
      </div>

      <fieldset className="standard-price">
        <legend className="field-caption">価格帯</legend>
        <div className="standard-price-row">
          <div className="standard-price-control">
            <div className={`price-slider${priceMin === priceMax ? " thumbs-together" : ""}`} style={{
              "--price-start": `${(priceMin - PRICE_MIN) / (PRICE_MAX - PRICE_MIN) * 100}%`,
              "--price-end": `${(priceMax - PRICE_MIN) / (PRICE_MAX - PRICE_MIN) * 100}%`,
            } as CSSProperties}>
              <input className={`price-range${priceMin === PRICE_MAX ? " at-end" : ""}`} type="range" aria-label="最小価格" min={PRICE_MIN} max={PRICE_MAX} step={500} value={priceMin}
                aria-valuetext={`${priceMin.toLocaleString("ja-JP")}円`} onInput={(e) => updateMinPrice(e.currentTarget.value)} onChange={(e) => updateMinPrice(e.currentTarget.value)} />
              <input className="price-range" type="range" aria-label="最大価格" min={PRICE_MIN} max={PRICE_MAX} step={500} value={priceMax}
                aria-valuetext={priceMax === PRICE_MAX ? "上限なし" : `${priceMax.toLocaleString("ja-JP")}円`} onInput={(e) => updateMaxPrice(e.currentTarget.value)} onChange={(e) => updateMaxPrice(e.currentTarget.value)} />
            </div>
            <div className="price-labels"><span>500円</span><span>15,000円</span><span>30,000円以上</span></div>
          </div>
          <output className="standard-price-value" aria-live="polite" aria-atomic="true">{priceLabel}</output>
        </div>
      </fieldset>

      <fieldset className="preference-field">
        <legend className="field-caption">好み <span className="field-hint">（複数選択可）</span></legend>
        <div className="preference-tags">{PREFERENCES.map((value, index) => <label className={`preference-tag${preferences.includes(value) ? " selected" : ""}`} key={value}>
          <input type="checkbox" checked={preferences.includes(value)} onChange={(e) => {
            const checked = e.target.checked;
            setPreferences((current) => checked
              ? current.includes(value) ? current : [...current, value]
              : current.filter((item) => item !== value));
          }} />
          <SearchIcon name={PREFERENCE_ICONS[index]} />{value}
        </label>)}</div>
      </fieldset>

      <details className="advanced-filters" open={advancedOpen} onToggle={(e) => setAdvancedOpen(e.currentTarget.open)}>
        <summary>詳細条件（性別・年代）</summary>
        <div className="advanced-content">
          <fieldset><legend>対象性別</legend><div className="radio-options">{GENDERS.map((value) => <label key={value}><input type="radio" name="gender" value={value} checked={gender === value} onChange={() => setGender(value)} />{value}</label>)}</div></fieldset>
          <fieldset><legend>対象年代</legend><div className="radio-options">{AGES.map((value) => <label key={value}><input type="radio" name="age" value={value} checked={age === value} onChange={() => setAge(value)} />{value}</label>)}</div></fieldset>
        </div>
      </details>

      <div className="search-actions">
        <button className="search-submit" type="submit" disabled={pending}><SearchIcon name="search" />{pending ? "検索中…" : "この条件で検索"}</button>
        <button className="clear-filters" type="button" disabled={pending} onClick={clear}><SearchIcon name="reset" />条件をクリア</button>
      </div>
      <p className="development-note"><strong>開発中：</strong>シーン・好み・性別・年代・並び替えは選択内容の確認のみで、検索結果には反映されません。結果は人気順です。カテゴリーは1件選択のみ反映し、複数選択時は全カテゴリーが対象です。</p>
    </form>
  );
}
