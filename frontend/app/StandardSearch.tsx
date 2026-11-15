"use client";

import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import type { SearchCondition } from "@/lib/api";

const CATEGORIES = ["食品", "飲料", "コスメ", "インテリア", "カタログギフト", "ビジネス小物", "フラワー", "家電", "酒類", "生活雑貨"];
const SCENES = ["送別", "誕生日", "お祝い", "取引先へのお礼", "母の日", "お歳暮", "お中元", "結婚祝い", "父の日", "出産祝い"];
const SORTS = ["おすすめ順", "人気順", "評価順", "価格の安い順", "新着順"];
// IDは表示名から分離したUI用の識別子。将来の好みマスタとの対応に使用する。
const PREFERENCES = [
  { id: "travel", label: "旅行好き" },
  { id: "gourmet", label: "グルメ好き" },
  { id: "beauty", label: "美容好き" },
  { id: "gadgets", label: "ガジェット好き" },
  { id: "plants-flowers", label: "植物・花好き" },
  { id: "simple", label: "シンプル好き" },
  { id: "alcohol", label: "お酒好き" },
  { id: "coffee-tea", label: "コーヒー・紅茶好き" },
  { id: "fashion", label: "おしゃれ好き" },
  { id: "interior", label: "インテリア好き" },
  { id: "cooking", label: "料理好き" },
  { id: "relaxation", label: "リラックス好き" },
  { id: "outdoors", label: "アウトドア好き" },
  { id: "health", label: "健康志向" },
  { id: "stationery", label: "文房具好き" },
  { id: "other", label: "その他" },
] as const;
type PreferenceId = (typeof PREFERENCES)[number]["id"];
const INITIAL_PREFERENCE_COUNT = 8;
const GENDERS = ["指定なし", "男性", "女性"];
const AGES = ["指定なし", "20代", "30代", "40代", "50代", "60代以上"];
const PRICE_MIN = 500;
const PRICE_MAX = 30000;
const PRICE_STEP = 500;
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
function SearchIcon({ name }: { name: string }) {
  return <svg className="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICON_PATHS[name]} /></svg>;
}
export default function StandardSearch({ onSearch, headerContent, tabsContent }: {
  onSearch: (condition: SearchCondition) => Promise<void>;
  headerContent: ReactNode;
  tabsContent: ReactNode;
}) {
  const [keyword, setKeyword] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [scene, setScene] = useState("");
  const [sort, setSort] = useState("人気順");
  const [priceMin, setPriceMin] = useState(PRICE_MIN);
  const [priceMax, setPriceMax] = useState(PRICE_MAX);
  const [minPriceDraft, setMinPriceDraft] = useState<string | null>(null);
  const [maxPriceDraft, setMaxPriceDraft] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<PreferenceId[]>([]);
  const [preferencesExpanded, setPreferencesExpanded] = useState(false);
  const [gender, setGender] = useState("指定なし");
  const [age, setAge] = useState("指定なし");
  const [pending, setPending] = useState(false);

  function clear() {
    setKeyword(""); setCategories([]); setScene(""); setSort("人気順");
    setPriceMin(PRICE_MIN); setPriceMax(PRICE_MAX); setPreferences([]);
    setMinPriceDraft(null); setMaxPriceDraft(null);
    setPreferencesExpanded(false);
    setGender("指定なし"); setAge("指定なし");
  }

  function updateMinPrice(value: string, fromText = false) {
    if (!/^\d*$/.test(value)) return;
    setMinPriceDraft(fromText ? value : null);
    if (!value) return;
    const rounded = Math.round(Number(value) / PRICE_STEP) * PRICE_STEP;
    setPriceMin(Math.max(PRICE_MIN, Math.min(rounded, priceMax)));
  }

  function updateMaxPrice(value: string, fromText = false) {
    if (value === "上限なし") {
      setMaxPriceDraft(null); setPriceMax(PRICE_MAX);
      return;
    }
    if (!/^\d*$/.test(value)) return;
    setMaxPriceDraft(fromText ? value : null);
    if (!value) return;
    const rounded = Math.round(Number(value) / PRICE_STEP) * PRICE_STEP;
    setPriceMax(Math.min(PRICE_MAX, Math.max(rounded, priceMin)));
  }

  const priceLabel = `${priceMin.toLocaleString("ja-JP")}円 〜 ${priceMax === PRICE_MAX ? "上限なし" : `${priceMax.toLocaleString("ja-JP")}円`}`;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const maxPrice = priceMax === PRICE_MAX ? undefined : priceMax;
    console.log("検索条件", { keyword, categories, scene, sort, priceMin,
      priceMax: maxPrice ?? null, preferences,
      preferenceLabels: PREFERENCES.filter(({ id }) => preferences.includes(id)).map(({ label }) => label),
      gender, age });
    setPending(true);
    try {
      // 未対応条件は送らず、既存のAPI契約を維持する。
      await onSearch({ keyword, category: "", categories,
        indivWrap: false, priceBand: "", priceMin, priceMax: maxPrice });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <div className="search-sticky-header">
        <div className="search-header-content">{headerContent}</div>
        <div className="search-header-controls">
          <div className="search-actions">
          <button className="search-submit" type="submit" form="standard-search-form" disabled={pending}><SearchIcon name="search" />{pending ? "検索中…" : "この条件で検索"}</button>
          <button className="clear-filters" type="button" disabled={pending} onClick={clear}><SearchIcon name="reset" />条件をクリア</button>
          </div>
          <label className="sort-field"><span>並び替え</span>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              {SORTS.map((value) => <option key={value}>{value}</option>)}
            </select>
          </label>
        </div>
      </div>
    <form id="standard-search-form" className="standard-search" onSubmit={submit}>
      <div className="search-condition-intro">
        {tabsContent}
        <p className="search-intro">いまの Giftia の検索（キーワード・カテゴリー・価格帯で探す）</p>
      </div>
      <label className="keyword-field">
        <span className="visually-hidden">キーワード</span>
        <SearchIcon name="search" />
        <input type="search" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="キーワード（例：送別 お菓子）" />
      </label>

      <fieldset className="tag-section">
        <legend className="field-caption">シーン（1つ選択）</legend>
        <div className="preference-tags">{SCENES.map((value) => <button type="button" className={`preference-tag${scene === value ? " selected" : ""}`} key={value} aria-pressed={scene === value} onClick={() => setScene((current) => current === value ? "" : value)}>
          <span aria-hidden="true">#</span>{value}
        </button>)}</div>
        <p className="tag-hint">未選択の場合はすべてのシーンが対象です。選択中のタグを押すと解除できます。</p>
      </fieldset>

      <fieldset className="tag-section">
        <legend className="field-caption">カテゴリー（複数選択可） <span className="preference-count" role="status">{categories.length}件選択中</span></legend>
        <div className="preference-tags">{CATEGORIES.map((category) => <label className={`preference-tag${categories.includes(category) ? " selected" : ""}`} key={category}>
          <input type="checkbox" name="categories" value={category} checked={categories.includes(category)} onChange={(e) => {
            const checked = e.target.checked;
            setCategories((current) => checked
              ? current.includes(category) ? current : [...current, category]
              : current.filter((item) => item !== category));
          }} />
          <span aria-hidden="true">#</span>{category}
        </label>)}</div>
        <p className="tag-hint">未選択の場合はすべてのカテゴリーが対象です。</p>
      </fieldset>

      <fieldset className="standard-price">
        <legend className="field-caption">価格帯</legend>
        <div className="standard-price-row">
          <label className="price-input-field"><span>最低価格</span>
            <div className="price-input-box"><input type="text" inputMode="numeric" aria-label="最低価格の金額入力" aria-describedby="price-input-hint" value={minPriceDraft ?? String(priceMin)}
              onFocus={(e) => e.currentTarget.select()} onChange={(e) => updateMinPrice(e.currentTarget.value, true)} onBlur={() => setMinPriceDraft(null)} /><span>円</span></div>
          </label>
          <div className="standard-price-control">
            <div className={`price-slider${priceMin === priceMax ? " thumbs-together" : ""}`} style={{
              "--price-start": `${(priceMin - PRICE_MIN) / (PRICE_MAX - PRICE_MIN) * 100}%`,
              "--price-end": `${(priceMax - PRICE_MIN) / (PRICE_MAX - PRICE_MIN) * 100}%`,
            } as CSSProperties}>
              <input className={`price-range${priceMin === PRICE_MAX ? " at-end" : ""}`} type="range" aria-label="最小価格" min={PRICE_MIN} max={PRICE_MAX} step={PRICE_STEP} value={priceMin}
                aria-valuetext={`${priceMin.toLocaleString("ja-JP")}円`} onInput={(e) => updateMinPrice(e.currentTarget.value)} onChange={(e) => updateMinPrice(e.currentTarget.value)} />
              <input className="price-range" type="range" aria-label="最大価格" min={PRICE_MIN} max={PRICE_MAX} step={PRICE_STEP} value={priceMax}
                aria-valuetext={priceMax === PRICE_MAX ? "上限なし" : `${priceMax.toLocaleString("ja-JP")}円`} onInput={(e) => updateMaxPrice(e.currentTarget.value)} onChange={(e) => updateMaxPrice(e.currentTarget.value)} />
            </div>
            <div className="price-labels"><span>500円</span><span>15,000円</span><span>30,000円以上</span></div>
          </div>
          <label className="price-input-field"><span>最高価格</span>
            <div className="price-input-box"><input type="text" inputMode="numeric" aria-label="最高価格の金額入力" aria-describedby="price-input-hint" value={maxPriceDraft ?? (priceMax === PRICE_MAX ? "上限なし" : String(priceMax))}
              onFocus={(e) => e.currentTarget.select()} onChange={(e) => updateMaxPrice(e.currentTarget.value, true)} onBlur={() => setMaxPriceDraft(null)} />{priceMax !== PRICE_MAX && <span>円</span>}</div>
          </label>
          <output className="standard-price-value" aria-live="polite" aria-atomic="true">{priceLabel}</output>
        </div>
        <div className="price-input-help"><p id="price-input-hint" className="tag-hint">入力金額は500円単位に調整します。最高価格30,000円以上は上限なしになります。</p>
          <button className="price-unlimited" type="button" onClick={() => updateMaxPrice("上限なし")}>最高価格を上限なしにする</button>
        </div>
      </fieldset>

      <fieldset className="preference-field">
        <legend className="field-caption">好み <span className="field-hint">（複数選択可）</span> <span className="preference-count" role="status">{preferences.length}件選択中</span></legend>
        <div id="preference-options" className="preference-tags">{(preferencesExpanded ? PREFERENCES : PREFERENCES.slice(0, INITIAL_PREFERENCE_COUNT)).map(({ id, label }) => <label className={`preference-tag${preferences.includes(id) ? " selected" : ""}`} key={id}>
          <input type="checkbox" name="preferences" value={id} checked={preferences.includes(id)} onChange={(e) => {
            const checked = e.target.checked;
            setPreferences((current) => checked
              ? current.includes(id) ? current : [...current, id]
              : current.filter((item) => item !== id));
          }} />
          <span aria-hidden="true">#</span>{label}
        </label>)}</div>
        <button className="preferences-toggle" type="button" aria-expanded={preferencesExpanded} aria-controls="preference-options" onClick={() => setPreferencesExpanded((current) => !current)}>{preferencesExpanded ? "閉じる" : "もっと見る"}<span aria-hidden="true">{preferencesExpanded ? "⌃" : "⌄"}</span></button>
      </fieldset>

      <fieldset className="tag-section">
        <legend className="field-caption">贈る相手の年代 <span className="field-hint">（1つ選択）</span></legend>
        <div className="preference-tags">{AGES.map((value) => <label className={`preference-tag${age === value ? " selected" : ""}`} key={value}>
          <input type="radio" name="age" value={value} checked={age === value} onChange={() => setAge(value)} />
          <span aria-hidden="true">#</span>{value}
        </label>)}</div>
      </fieldset>

      <fieldset className="tag-section">
        <legend className="field-caption">贈る相手の性別 <span className="field-hint">（1つ選択）</span></legend>
        <div className="preference-tags">{GENDERS.map((value) => <label className={`preference-tag${gender === value ? " selected" : ""}`} key={value}>
          <input type="radio" name="gender" value={value} checked={gender === value} onChange={() => setGender(value)} />
          <span aria-hidden="true">#</span>{value}
        </label>)}</div>
      </fieldset>

      <p className="development-note"><strong>開発中：</strong>シーン・好み・性別・年代・並び替えは選択内容の確認のみで、検索結果には反映されません。結果は人気順です。カテゴリーは選択したいずれかに該当する商品が対象です。</p>
    </form>
    </>
  );
}
