// app/page.tsx — Giftia 検索画面（2週目・穴埋め版）
// 【穴7】【穴8】を、対応表と公式ドキュメントを頼りに自分で埋める。
// 答えは 配布コード/答え合わせ/frontend/page.tsx（自分で埋めてから見る）。
// 1週目との違い：①searchGifts が FastAPI を呼ぶ（async/await）②入力した条件を渡す ③つながらないときの表示
"use client"; // ← ブラウザで動く合図。useState や onClick を使う画面に必要

import { useState, type CSSProperties } from "react";
import ResultCard from "./ResultCard";
import StandardSearch from "./StandardSearch";
import { searchGifts, type Gift, type SearchCondition } from "@/lib/api";

const PRICE_MAX = 30000;
const PRICE_STEP = 500;

export default function Home() {
  // ① 状態（変化するデータ）を覚える箱
  const [mode, setMode] = useState<"standard" | "business">("standard"); // どのタブか
  const [indivWrap, setIndivWrap] = useState(false);                      // 個包装だけ（取引先へのお礼）
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(PRICE_MAX); // 右端は上限なし
  const [results, setResults] = useState<Gift[] | null>(null);            // 検索結果
  const [error, setError] = useState("");                                 // つながらないときの文言

  async function searchStandard(condition: SearchCondition) {
    setError("");
    try {
      setResults(await searchGifts(condition));
    } catch (err) {
      setResults(null);
      setError(`APIにつながりません：${(err as Error).message}`);
    }
  }

  // ② 検索ボタンの処理（API に聞くので、結果が返るまで待つ＝async/await）
  async function onSearch(e: React.FormEvent) {
    e.preventDefault(); // ページの再読み込みを止める
    setError("");
    const selectedCategories: string[] = [];
    const maxPrice = priceMax === PRICE_MAX ? undefined : priceMax;
    console.log("検索条件", {
      categories: selectedCategories,
      priceMin,
      priceMax: maxPrice ?? null, // null は上限なし
    });
    const condition = { keyword: "", category: "", indivWrap, priceBand: "" };
    try {
      setResults(await searchGifts({ ...condition, priceMin, priceMax: maxPrice }));
    } catch (err) {
      setResults(null);
      setError(`APIにつながりません：${(err as Error).message}`); // 原因はブラウザの Console に出る
    }
  }

  // ③ 画面
  return (
    <main className={`page${mode === "standard" ? " standard-page" : ""}`}>
      <header className="header"><h1>Giftia</h1></header>

      {/* タブ：state(mode)＋条件で出し分ける */}
      <nav className="modes">
        <button className={mode === "standard" ? "on" : ""} onClick={() => { setMode("standard"); setResults(null); }}>いまの検索</button>
        <button className={mode === "business" ? "on" : ""} onClick={() => { setMode("business"); setResults(null); }}>取引先へのお礼</button>
      </nav>

      <div hidden={mode !== "standard"}>
        <StandardSearch onSearch={searchStandard} />
      </div>
      {mode === "business" && <form className="form" onSubmit={onSearch}>
            <label className="chk"><input type="checkbox" checked={indivWrap} onChange={(e) => setIndivWrap(e.target.checked)} /> 個包装</label>
        <fieldset className="filter-group price-filter" aria-describedby="price-note">
          <legend>価格帯（500円刻み）</legend>
          <p className="price-value">{priceMin.toLocaleString("ja-JP")}円 〜 {priceMax === PRICE_MAX ? "上限なし" : `${priceMax.toLocaleString("ja-JP")}円`}</p>
          <div className="price-slider" style={{
            "--price-start": `${priceMin / PRICE_MAX * 100}%`,
            "--price-end": `${priceMax / PRICE_MAX * 100}%`,
          } as CSSProperties}>
            <input className={`price-range${priceMin === PRICE_MAX ? " at-end" : ""}`} type="range" aria-label="最小価格" aria-describedby="price-note" min={0} max={PRICE_MAX} step={PRICE_STEP} value={priceMin}
              aria-valuetext={`${priceMin.toLocaleString("ja-JP")}円`}
              onChange={(e) => setPriceMin(Math.min(Number(e.target.value), priceMax))} />
            <input className="price-range" type="range" aria-label="最大価格" aria-describedby="price-note" min={0} max={PRICE_MAX} step={PRICE_STEP} value={priceMax}
              aria-valuetext={priceMax === PRICE_MAX ? "上限なし" : `${priceMax.toLocaleString("ja-JP")}円`}
              onChange={(e) => setPriceMax(Math.max(Number(e.target.value), priceMin))} />
          </div>
          <div className="price-labels"><span>0円</span><span>30,000円以上（上限なし）</span></div>
          <p id="price-note" className="summary">左のつまみで最小価格、右のつまみで最大価格を指定します。右端は上限なしです。</p>
        </fieldset>
        <button type="submit">検索</button>
      </form>}

      {error && <p className="summary">{error}</p>}

      {/* 結果：同じ ResultCard を map で並べる（使い回し） */}
      {results && (
        <section>
          <p className="summary">上位 {results.length} 件</p>
          <div className="grid">
            {results.map((g, i) => <ResultCard key={g.id} gift={g} rank={i + 1} />)}
          </div>
        </section>
      )}
    </main>
  );
}
