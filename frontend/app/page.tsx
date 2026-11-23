"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import ResultCard from "./ResultCard";
import StandardSearch from "./StandardSearch";
import { searchGifts, type Gift, type SearchCondition } from "@/lib/api";
import { loadSavedSearch, saveSearchResults, saveSearchScroll, useIsClient } from "@/lib/searchSession";

export default function Home() {
  // undefined：この画面でまだ検索していない（商品詳細から戻ったときは、保存した結果を表示する）
  const [results, setResults] = useState<Gift[] | null | undefined>(undefined);
  const [error, setError] = useState("");
  const searchVersion = useRef(0);

  // 商品詳細から戻ったときに復元する検索状態（画面を開いたときに1回だけ読む）
  const isClient = useIsClient();
  const [saved] = useState(() => (typeof window === "undefined" ? null : loadSavedSearch()));
  const restored = isClient ? saved : null;
  const shownResults = results === undefined ? restored?.results ?? null : results;

  // 商品を開いたときのスクロール位置に戻す（1回だけ）
  const scrollRestored = useRef(false);
  useEffect(() => {
    const y = restored?.scrollY;
    if (!y || scrollRestored.current) return;
    scrollRestored.current = true;
    requestAnimationFrame(() => window.scrollTo(0, y));
  }, [restored]);

  async function searchStandard(condition: SearchCondition) {
    const version = ++searchVersion.current;
    setError("");
    try {
      const gifts = await searchGifts(condition);
      if (version === searchVersion.current) {
        setResults(gifts);
        saveSearchResults(gifts);
      }
    } catch (err) {
      if (version !== searchVersion.current) return;
      setResults(null);
      saveSearchResults(null);
      setError(`APIにつながりません：${(err as Error).message}`);
    }
  }

  function resetResults() {
    searchVersion.current++;
    setResults(null);
    saveSearchResults(null);
    setError("");
  }

  const headerContent = <header className="header"><h1>
    <Image className="giftia-logo" src="/giftia-logo.png" alt="Giftia" width={1297} height={371} unoptimized preload />
  </h1></header>;

  return (
    <main className="page standard-page">
      {/* key：ブラウザで動き始めたら作り直し、保存した検索条件（initial）を入れる */}
      <StandardSearch key={isClient ? "client" : "server"} initial={restored ?? undefined}
        onSearch={searchStandard} onModeChange={resetResults} headerContent={headerContent} />
      {error && <p className="summary" role="alert">{error}</p>}
      {shownResults && (
        <section>
          <p className="summary">上位 {shownResults.length} 件</p>
          {shownResults.length === 0 && <p role="status">条件に一致する商品がありません。年代・性別・好みなどの条件を解除して、もう一度検索してください。</p>}
          {/* 商品を開く直前のスクロール位置を覚えておく（戻ったときに同じ位置へ） */}
          <div className="grid" onClickCapture={() => saveSearchScroll(window.scrollY)}>
            {shownResults.map((g, i) => <ResultCard key={g.id} gift={g} rank={i + 1} />)}
          </div>
        </section>
      )}
    </main>
  );
}
