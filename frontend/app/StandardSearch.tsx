"use client";

import { useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import type { SearchCondition, SearchSort, PopularityPeriod } from "@/lib/api";
import { needsGiftPolicy, recommendationRequirement, type GiftPolicy } from "@/lib/recommendationUi";

const CATEGORIES = ["食品", "飲料", "コスメ", "インテリア", "カタログギフト", "ビジネス小物", "フラワー", "家電", "酒類", "生活雑貨"];
const SCENES = ["送別", "取引先へのお礼", "誕生日", "お祝い", "母の日", "お歳暮", "お中元", "結婚祝い", "父の日", "出産祝い"];
// giftia_t105の実データで同名タグを確認済み。「お礼」への読み替えはしない。
const FILTERABLE_SCENES = new Set(["送別", "誕生日", "母の日", "お歳暮", "お中元", "結婚祝い", "父の日", "出産祝い"]);
const GIFT_POLICIES: { value: GiftPolicy; label: string }[] = [
  { value: "classic", label: "王道" }, { value: "unique", label: "ユニーク" },
];
type SearchMode = "simple" | "recommended";
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
export default function StandardSearch({ onSearch, onModeChange, headerContent }: {
  onSearch: (condition: SearchCondition) => Promise<void>;
  headerContent: ReactNode;
  onModeChange: () => void;
}) {
  const [mode, setMode] = useState<SearchMode>("simple");
  const [keyword, setKeyword] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [scene, setScene] = useState("");
  const [giftPolicy, setGiftPolicy] = useState<GiftPolicy>("");
  const [sort, setSort] = useState<SearchSort>("popular");
  const [popularityPeriod, setPopularityPeriod] = useState<PopularityPeriod>("monthly");
  const lastSearch = useRef<SearchCondition | null>(null);
  const requestVersion = useRef(0);
  const [priceMin, setPriceMin] = useState(PRICE_MIN);
  const [priceMax, setPriceMax] = useState(PRICE_MAX);
  const [minPriceDraft, setMinPriceDraft] = useState<string | null>(null);
  const [maxPriceDraft, setMaxPriceDraft] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<PreferenceId[]>([]);
  const [preferencesExpanded, setPreferencesExpanded] = useState(false);
  const [gender, setGender] = useState("指定なし");
  const [age, setAge] = useState("指定なし");
  const [pending, setPending] = useState(false);

  function changeMode(next: SearchMode) {
    if (next === mode) return;
    setMode(next);
    requestVersion.current++;
    lastSearch.current = null;
    setPending(false);
    onModeChange();
  }

  function clear() {
    setKeyword(""); setCategories([]); setScene(""); setGiftPolicy(""); setSort("popular");
    setPopularityPeriod("monthly"); lastSearch.current = null;
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
  const requiredInputMessage = recommendationRequirement(mode, scene, giftPolicy);
  // おすすめ検索から保持した未対応シーンを無視して検索しない。
  const sceneVerificationMessage = mode === "simple" && scene && !FILTERABLE_SCENES.has(scene)
    ? "選択中のシーンはDBとの対応が未確定です。選択を解除するか、対応済みのシーンを選んでください。" : "";

  function selectScene(value: string) {
    const nextScene = scene === value ? "" : value;
    setScene(nextScene);
    if (!needsGiftPolicy(nextScene)) setGiftPolicy("");
  }

  async function runSearch(condition: SearchCondition) {
    const version = ++requestVersion.current;
    lastSearch.current = condition;
    setPending(true);
    try {
      await onSearch(condition);
    } finally {
      if (version === requestVersion.current) setPending(false);
    }
  }

  function changeSort(value: SearchSort) {
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
    if (mode === "recommended" || requiredInputMessage || sceneVerificationMessage) return;
    const maxPrice = priceMax === PRICE_MAX ? undefined : priceMax;
    console.log("検索条件", { keyword, categories, scene, giftPolicy, sort, popularityPeriod, priceMin,
      priceMax: maxPrice ?? null, preferences,
      preferenceLabels: PREFERENCES.filter(({ id }) => preferences.includes(id)).map(({ label }) => label),
      gender, age });
    await runSearch({ keyword, category: "", categories, scene,
      indivWrap: false, priceBand: "", priceMin, priceMax: maxPrice, sort, popularityPeriod });
  }

  return (
    <>
      <div className="search-sticky-header">
        <div className="search-header-content">{headerContent}
          <nav className="modes search-mode-tabs" aria-label="検索モード">
            <button type="button" className={mode === "recommended" ? "on" : ""} aria-pressed={mode === "recommended"} onClick={() => changeMode("recommended")}>おすすめ検索</button>
            <button type="button" className={mode === "simple" ? "on" : ""} aria-pressed={mode === "simple"} onClick={() => changeMode("simple")}>シンプル検索</button>
          </nav>
        </div>
        <div className="search-header-controls">
          <div className="search-actions">
          <button className="search-submit" type="submit" form="standard-search-form" disabled={pending || mode === "recommended" || !!sceneVerificationMessage} aria-describedby={mode === "recommended" ? "recommendation-guidance" : sceneVerificationMessage ? "scene-verification-guidance" : undefined}><SearchIcon name="search" />{mode === "recommended" ? "おすすめ検索は準備中" : pending ? "検索中…" : "この条件で検索"}</button>
          <button className="clear-filters" type="button" disabled={pending} onClick={clear}><SearchIcon name="reset" />条件をクリア</button>
          </div>
          {mode === "simple" && <div className="search-sort-controls">
          <label className="sort-field"><span>並び替え</span>
            <select value={sort} onChange={(e) => changeSort(e.target.value as SearchSort)}>
              {SORTS.map(({ value, label, disabled }) => <option key={value} value={value} disabled={disabled}>{label}</option>)}
            </select>
          </label>
          {sort === "popular" && <label className="sort-field"><span>集計期間</span>
            <select value={popularityPeriod} onChange={(e) => changePeriod(e.target.value as PopularityPeriod)}>
              {POPULARITY_PERIODS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>}
          </div>}
          {mode === "recommended" && <p id="recommendation-guidance" className="tag-hint" role="status">{requiredInputMessage || "おすすめ検索は準備中です。ランキング機能の公開後に検索できます。"}</p>}
          {sceneVerificationMessage && <p id="scene-verification-guidance" className="tag-hint" role="status">{sceneVerificationMessage}</p>}
        </div>
      </div>
    <form id="standard-search-form" className="standard-search" onSubmit={submit}>
      <div className="search-condition-intro">
        <p className="search-intro">{mode === "simple" ? "条件に合う商品を絞り込み、比較するシンプル検索" : "贈り物選びをサポートするおすすめ検索（準備中）"}</p>
      </div>
      <label className="keyword-field">
        <span className="visually-hidden">キーワード</span>
        <SearchIcon name="search" />
        <input type="search" value={keyword} onChange={(e) => setKeyword(e.target.value)} placeholder="キーワード（例：送別 お菓子）" />
      </label>

      <fieldset className="tag-section">
        <legend className="field-caption">シーン（1つ選択）{mode === "recommended" && <span className="field-hint">必須</span>}</legend>
        <div className="preference-tags">{SCENES.map((value) => <button type="button" className={`preference-tag${scene === value ? " selected" : ""}`} key={value} disabled={mode === "simple" && !FILTERABLE_SCENES.has(value) && scene !== value} aria-pressed={scene === value} onClick={() => selectScene(value)}>
          <span aria-hidden="true">#</span>{value}
        </button>)}</div>
        <p className="tag-hint">選択中のタグを押すと解除できます。シンプル検索では同名タグで商品を絞り込みます。「取引先へのお礼」「お祝い」はDBとの対応が未確定のため、新たに選択できません。おすすめ検索では選択できますが、検索実行は準備中です。</p>
      </fieldset>

      {mode === "recommended" && needsGiftPolicy(scene) && <fieldset className="tag-section">
        <legend className="field-caption">ギフトポリシー <span className="field-hint">（1つ選択・必須）</span></legend>
        <div className="preference-tags">{GIFT_POLICIES.map(({ value, label }) => <button type="button" className={`preference-tag${giftPolicy === value ? " selected" : ""}`} key={value} aria-pressed={giftPolicy === value} onClick={() => setGiftPolicy((current) => current === value ? "" : value)}>
          <span aria-hidden="true">#</span>{label}
        </button>)}</div>
        <p className="tag-hint">おすすめ検索専用です。データ未整備のため、現在ランキングには反映されません。</p>
      </fieldset>}

      <fieldset className="tag-section">
        <legend className="field-caption">贈る相手の年代 <span className="field-hint">（今後対応予定）</span></legend>
        <div className="preference-tags">{AGES.map((value) => <label className={`preference-tag${age === value ? " selected" : ""}`} key={value}>
          <input type="radio" name="age" value={value} checked={age === value} onChange={() => setAge(value)} />
          <span aria-hidden="true">#</span>{value}
        </label>)}</div>
      </fieldset>

      <fieldset className="tag-section">
        <legend className="field-caption">贈る相手の性別 <span className="field-hint">（今後対応予定）</span></legend>
        <div className="preference-tags">{GENDERS.map((value) => <label className={`preference-tag${gender === value ? " selected" : ""}`} key={value}>
          <input type="radio" name="gender" value={value} checked={gender === value} onChange={() => setGender(value)} />
          <span aria-hidden="true">#</span>{value}
        </label>)}</div>
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

      <fieldset className="preference-field">
        <legend className="field-caption">好み <span className="field-hint">（今後対応予定）</span> <span className="preference-count" role="status">{preferences.length}件選択中</span></legend>
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

      <p className="development-note"><strong>開発中：</strong>年代・性別・好みはUIで選択できますが、検索結果への反映は今後対応予定です。ギフトポリシーのデータも未整備です。おすすめ検索・新着順は準備中で、おすすめランキング・理由表示は行いません。評価順は口コミ数を考慮した補正評価を使用します。並び替え・期間変更では直前に検索した条件を使用します。</p>
    </form>
    </>
  );
}
