"use client";

import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import type { SearchCondition, SearchSort, PopularityPeriod } from "@/lib/api";
import { needsGiftPolicy, recommendationRequirement, type GiftPolicy } from "@/lib/recommendationUi";
import { clearSavedSearch, saveSearchForm, type SavedSearch, type SavedSearchForm } from "@/lib/searchSession";

const CATEGORIES = ["食品", "飲料", "コスメ", "インテリア", "カタログギフト", "ビジネス小物", "フラワー", "家電", "酒類", "生活雑貨"];
const SCENES = ["送別", "取引先へのお礼", "誕生日", "お祝い", "母の日", "お歳暮", "お中元", "結婚祝い", "父の日", "出産祝い"];
// giftia_t105の実データで同名タグを確認済み。「お礼」への読み替えはしない。
const FILTERABLE_SCENES = new Set(["送別", "誕生日", "母の日", "お歳暮", "お中元", "結婚祝い", "父の日", "出産祝い"]);
const GIFT_POLICIES: { value: GiftPolicy; label: string }[] = [
  { value: "classic", label: "王道" }, { value: "unique", label: "ユニーク" },
];
type SearchMode = "simple" | "recommended";
type SimpleSort = Exclude<SearchSort, "recommend">;
const SORTS = [
  { value: "popular", label: "人気順" },
  { value: "rating", label: "評価順" },
  { value: "price_asc", label: "価格の安い順" },
  { value: "newest", label: "新着順（準備中）", disabled: true },
];
const POPULARITY_PERIODS: { value: PopularityPeriod; label: string }[] = [
  { value: "weekly", label: "週間" }, { value: "monthly", label: "月間" },
  { value: "yearly", label: "年間" }, { value: "all", label: "全期間" },
];
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
  sparkles: "M9.94 15.5a2 2 0 0 0-1.44-1.44L3 12l5.5-2.06a2 2 0 0 0 1.44-1.44L12 3l2.06 5.5a2 2 0 0 0 1.44 1.44L21 12l-5.5 2.06a2 2 0 0 0-1.44 1.44L12 21l-2.06-5.5ZM5 3v4M3 5h4M19 17v4M17 19h4",
  slidersHorizontal: "M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4",
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
export default function StandardSearch({ onSearch, onModeChange, headerContent, initial }: {
  onSearch: (condition: SearchCondition) => Promise<void>;
  headerContent: ReactNode;
  onModeChange: () => void;
  initial?: SavedSearch; // 商品詳細から戻ったときに復元する検索条件（lib/searchSession.ts）
}) {
  const saved = initial?.form;
  const [mode, setMode] = useState<SearchMode>(saved?.mode ?? "simple");
  const [keyword, setKeyword] = useState(saved?.keyword ?? "");
  const [categories, setCategories] = useState<string[]>(saved?.categories ?? []);
  const [scene, setScene] = useState(saved?.scene ?? "");
  const [giftPolicy, setGiftPolicy] = useState<GiftPolicy>((saved?.giftPolicy ?? "") as GiftPolicy);
  const [sort, setSort] = useState<SimpleSort>((saved?.sort ?? "popular") as SimpleSort);
  const [popularityPeriod, setPopularityPeriod] = useState<PopularityPeriod>((saved?.popularityPeriod ?? "monthly") as PopularityPeriod);
  const lastSearch = useRef<SearchCondition | null>(initial?.condition ?? null);
  const lastRecommendationInputs = useRef<string | null>(
    initial?.condition?.sort === "recommend" ? JSON.stringify(initial.condition) : null);
  const requestVersion = useRef(0);
  const [priceMin, setPriceMin] = useState(saved?.priceMin ?? PRICE_MIN);
  const [priceMax, setPriceMax] = useState(saved?.priceMax ?? PRICE_MAX);
  const [minPriceDraft, setMinPriceDraft] = useState<string | null>(null);
  const [maxPriceDraft, setMaxPriceDraft] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<PreferenceId[]>((saved?.preferences ?? []) as PreferenceId[]);
  const [preferencesExpanded, setPreferencesExpanded] = useState(false);
  const [gender, setGender] = useState(saved?.gender ?? "指定なし");
  const [age, setAge] = useState(saved?.age ?? "指定なし");
  const [pending, setPending] = useState(false);

  // 検索したあとは、入力内容を一時保存しておく（商品詳細から戻ったときに復元するため）
  useEffect(() => {
    if (!lastSearch.current) return;
    const form: SavedSearchForm = { mode, keyword, categories, scene, giftPolicy, sort, popularityPeriod,
      priceMin, priceMax, preferences, gender, age };
    saveSearchForm(form, lastSearch.current);
  });

  function changeMode(next: SearchMode) {
    if (next === mode) return;
    setMode(next);
    requestVersion.current++;
    lastSearch.current = null;
    lastRecommendationInputs.current = null;
    setPending(false);
    onModeChange();
    clearSavedSearch();
  }

  function clear() {
    requestVersion.current++;
    onModeChange();
    clearSavedSearch();
    setKeyword(""); setCategories([]); setScene(""); setGiftPolicy(""); setSort("popular");
    setPopularityPeriod("monthly"); lastSearch.current = null;
    lastRecommendationInputs.current = null;
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
    const next = Math.max(PRICE_MIN, Math.min(rounded, priceMax));
    setPriceMin(next);
    refreshRecommendation({ priceMin: next });
  }

  function updateMaxPrice(value: string, fromText = false) {
    if (value === "上限なし") {
      setMaxPriceDraft(null); setPriceMax(PRICE_MAX);
      refreshRecommendation({ priceMax: undefined });
      return;
    }
    if (!/^\d*$/.test(value)) return;
    setMaxPriceDraft(fromText ? value : null);
    if (!value) return;
    const rounded = Math.round(Number(value) / PRICE_STEP) * PRICE_STEP;
    const next = Math.min(PRICE_MAX, Math.max(rounded, priceMin));
    setPriceMax(next);
    refreshRecommendation({ priceMax: next === PRICE_MAX ? undefined : next });
  }

  const priceLabel = `${priceMin.toLocaleString("ja-JP")}円 〜 ${priceMax === PRICE_MAX ? "上限なし" : `${priceMax.toLocaleString("ja-JP")}円`}`;
  const requiredInputMessage = recommendationRequirement(mode, scene, giftPolicy);
  const recommendationMessage = requiredInputMessage || (mode === "recommended" && scene !== "送別"
    ? "現在のおまかせで探すモードは送別シーンのみ対応しています。他のシーンは今後対応予定です。" : "");
  const visibleRecommendationMessage = scene && needsGiftPolicy(scene) && !giftPolicy ? "" : recommendationMessage;
  // おすすめ検索から保持した未対応シーンを無視して検索しない。
  const sceneVerificationMessage = mode === "simple" && scene && !FILTERABLE_SCENES.has(scene)
    ? "選択中のシーンはDBとの対応が未確定です。選択を解除するか、対応済みのシーンを選んでください。" : "";

  function selectScene(value: string) {
    const nextScene = scene === value ? "" : value;
    setScene(nextScene);
    if (!needsGiftPolicy(nextScene)) setGiftPolicy("");
    refreshRecommendation({ scene: nextScene, giftPolicy: needsGiftPolicy(nextScene) ? giftPolicy : "" });
  }

  function currentCondition(): SearchCondition {
    return { keyword, category: "", categories, scene, indivWrap: false, priceBand: "",
      targetAge: age === "指定なし" ? undefined : age,
      targetGender: gender === "指定なし" ? undefined : gender, preferences,
      priceMin, priceMax: priceMax === PRICE_MAX ? undefined : priceMax,
      sort: mode === "recommended" ? "recommend" : sort,
      popularityPeriod, ...(mode === "recommended" ? { giftPolicy } : {}) };
  }

  function refreshRecommendation(changes: Partial<SearchCondition>) {
    if (mode !== "recommended" || lastSearch.current?.sort !== "recommend") return;
    const condition = { ...currentCondition(), ...changes };
    if (condition.scene !== "送別" || !condition.giftPolicy) {
      lastRecommendationInputs.current = null;
      requestVersion.current++;
      setPending(false);
      onModeChange();
      return;
    }
    // rangeのinput/changeの両イベントで同一検索を重複送信しない。
    if (JSON.stringify(condition) === lastRecommendationInputs.current) return;
    void runSearch(condition);
  }

  function selectPolicy(value: GiftPolicy) {
    const next = giftPolicy === value ? "" : value;
    setGiftPolicy(next);
    refreshRecommendation({ giftPolicy: next });
  }

  async function runSearch(condition: SearchCondition) {
    const version = ++requestVersion.current;
    lastSearch.current = condition;
    if (condition.sort === "recommend") lastRecommendationInputs.current = JSON.stringify(condition);
    setPending(true);
    try {
      await onSearch(condition);
    } finally {
      if (version === requestVersion.current) setPending(false);
    }
  }

  function changeSort(value: SimpleSort) {
    setSort(value);
    if (lastSearch.current) void runSearch({ ...lastSearch.current, sort: value, popularityPeriod });
  }

  function changePeriod(value: PopularityPeriod) {
    setPopularityPeriod(value);
    if (lastSearch.current) void runSearch({ ...lastSearch.current, sort, popularityPeriod: value });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // ボタン無効化だけに依存せず、Enterやプログラムからのsubmitも制御する。
    if (recommendationMessage || sceneVerificationMessage) return;
    const maxPrice = priceMax === PRICE_MAX ? undefined : priceMax;
    console.log("検索条件", { keyword, categories, scene, giftPolicy, sort, popularityPeriod, priceMin,
      priceMax: maxPrice ?? null, preferences,
      preferenceLabels: PREFERENCES.filter(({ id }) => preferences.includes(id)).map(({ label }) => label),
      gender, age });
    await runSearch(currentCondition());
  }

  // 検索・クリアボタン。ヘッダー（縦並びのとき）と左欄の下（2列のとき）に置き、CSSでどちらか一方だけ表示する
  const actionButtons = <>
    <button className="search-submit" type="submit" form="standard-search-form" disabled={pending || !!recommendationMessage || !!sceneVerificationMessage} aria-describedby={mode === "recommended" && visibleRecommendationMessage ? "recommendation-guidance" : sceneVerificationMessage ? "scene-verification-guidance" : undefined}><SearchIcon name="search" />{pending ? "検索中…" : "この条件で検索"}</button>
    <button className="clear-filters" type="button" disabled={pending} onClick={clear}><SearchIcon name="reset" />条件をクリア</button>
  </>;

  return (
    <>
      <div className="search-sticky-header">
        <div className="search-header-content">{headerContent}
          <nav className="modes search-mode-tabs" aria-label="検索モード">
            <button type="button" className={mode === "recommended" ? "on" : ""} aria-pressed={mode === "recommended"} onClick={() => changeMode("recommended")}><SearchIcon name="sparkles" />おまかせで探す</button>
            <button type="button" className={mode === "simple" ? "on" : ""} aria-pressed={mode === "simple"} onClick={() => changeMode("simple")}><SearchIcon name="slidersHorizontal" />自分で探す</button>
          </nav>
        </div>
        <div className="search-header-controls">
          <div className="search-actions">{actionButtons}</div>
          {mode === "simple" && <div className="search-sort-controls">
          <label className="sort-field"><span>並び替え</span>
            <select value={sort} onChange={(e) => changeSort(e.target.value as SimpleSort)}>
              {SORTS.map(({ value, label, disabled }) => <option key={value} value={value} disabled={disabled}>{label}</option>)}
            </select>
          </label>
          {sort === "popular" && <label className="sort-field"><span>集計期間</span>
            <select value={popularityPeriod} onChange={(e) => changePeriod(e.target.value as PopularityPeriod)}>
              {POPULARITY_PERIODS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>}
          </div>}
          {mode === "recommended" && visibleRecommendationMessage && <p id="recommendation-guidance" className="tag-hint" role="status">{visibleRecommendationMessage}</p>}
          {sceneVerificationMessage && <p id="scene-verification-guidance" className="tag-hint" role="status">{sceneVerificationMessage}</p>}
        </div>
      </div>
    <form id="standard-search-form" className="standard-search" onSubmit={submit}>
      <div className="search-condition-intro">
        <p className="search-intro">{mode === "simple" ? "キーワードや条件を指定して商品を検索" : "贈りたいギフトの方向性から、おすすめを提案"}</p>
      </div>
      <label className="keyword-field">
        <span className="visually-hidden">キーワード</span>
        <SearchIcon name="search" />
        <input type="search" value={keyword} onChange={(e) => { setKeyword(e.target.value); refreshRecommendation({ keyword: e.target.value }); }} placeholder="キーワード（例：送別 お菓子）" />
      </label>

      <fieldset className="tag-section">
        <legend className="field-caption">シーン（1つ選択）{mode === "recommended" && <span className="field-hint">必須</span>}</legend>
        <div className="preference-tags">{SCENES.map((value) => <button type="button" className={`preference-tag${scene === value ? " selected" : ""}`} key={value} disabled={mode === "simple" && !FILTERABLE_SCENES.has(value) && scene !== value} aria-pressed={scene === value} onClick={() => selectScene(value)}>
          <span aria-hidden="true">#</span>{value}
        </button>)}</div>
      </fieldset>

      {mode === "recommended" && needsGiftPolicy(scene) && <fieldset className="tag-section">
        <legend className="field-caption">ギフトポリシー <span className="field-hint">（1つ選択・必須）</span></legend>
        <div className="preference-tags">{GIFT_POLICIES.map(({ value, label }) => <button type="button" className={`preference-tag${giftPolicy === value ? " selected" : ""}`} key={value} aria-pressed={giftPolicy === value} onClick={() => selectPolicy(value)}>
          <span aria-hidden="true">#</span>{label}
        </button>)}</div>
      </fieldset>}

      <fieldset className="tag-section">
        <legend className="field-caption">贈る相手の年代 <span className="field-hint">（任意）</span></legend>
        <div className="preference-tags">{AGES.map((value) => <label className={`preference-tag${age === value ? " selected" : ""}`} key={value}>
          <input type="radio" name="age" value={value} checked={age === value} onChange={() => {
            setAge(value); refreshRecommendation({ targetAge: value === "指定なし" ? undefined : value });
          }} />
          <span aria-hidden="true">#</span>{value}
        </label>)}</div>
      </fieldset>

      <fieldset className="tag-section">
        <legend className="field-caption">贈る相手の性別 <span className="field-hint">（任意）</span></legend>
        <div className="preference-tags">{GENDERS.map((value) => <label className={`preference-tag${gender === value ? " selected" : ""}`} key={value}>
          <input type="radio" name="gender" value={value} checked={gender === value} onChange={() => {
            setGender(value); refreshRecommendation({ targetGender: value === "指定なし" ? undefined : value });
          }} />
          <span aria-hidden="true">#</span>{value}
        </label>)}</div>
      </fieldset>

      <fieldset className="tag-section">
        <legend className="field-caption">カテゴリー（複数選択可） <span className="preference-count" role="status">{categories.length}件選択中</span></legend>
        <div className="preference-tags">{CATEGORIES.map((category) => <label className={`preference-tag${categories.includes(category) ? " selected" : ""}`} key={category}>
          <input type="checkbox" name="categories" value={category} checked={categories.includes(category)} onChange={(e) => {
            const checked = e.target.checked;
            const next = checked ? categories.includes(category) ? categories : [...categories, category]
              : categories.filter((item) => item !== category);
            setCategories(next);
            refreshRecommendation({ categories: next });
          }} />
          <span aria-hidden="true">#</span>{category}
        </label>)}</div>
      </fieldset>

      <fieldset className="preference-field">
        <legend className="field-caption">好み <span className="field-hint">（複数選択可）</span> <span className="preference-count" role="status">{preferences.length}件選択中</span></legend>
        <div id="preference-options" className="preference-tags">{(preferencesExpanded ? PREFERENCES : PREFERENCES.slice(0, INITIAL_PREFERENCE_COUNT)).map(({ id, label }) => <label className={`preference-tag${preferences.includes(id) ? " selected" : ""}`} key={id}>
          <input type="checkbox" name="preferences" value={id} checked={preferences.includes(id)} onChange={(e) => {
            const checked = e.target.checked;
            const next = checked ? preferences.includes(id) ? preferences : [...preferences, id]
              : preferences.filter((item) => item !== id);
            setPreferences(next);
            refreshRecommendation({ preferences: next });
          }} />
          <span aria-hidden="true">#</span>{label}
        </label>)}</div>
        <button className="preferences-toggle" type="button" aria-expanded={preferencesExpanded} aria-controls="preference-options" onClick={() => setPreferencesExpanded((current) => !current)}>{preferencesExpanded ? "閉じる" : "もっと見る"}<span aria-hidden="true">{preferencesExpanded ? "⌃" : "⌄"}</span></button>
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

      {/* 2列レイアウトのとき：左欄の一番下に固定（app/globals.css の .search-panel-actions） */}
      <div className="search-actions search-panel-actions">{actionButtons}</div>
    </form>
    </>
  );
}
