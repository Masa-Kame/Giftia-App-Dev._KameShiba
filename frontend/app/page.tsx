"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import ResultCard from "./ResultCard";
import StandardSearch from "./StandardSearch";
import { searchGifts, type Gift, type SearchCondition } from "@/lib/api";

export default function Home() {
  const [results, setResults] = useState<Gift[] | null>(null);
  const [error, setError] = useState("");
  const searchVersion = useRef(0);

  async function searchStandard(condition: SearchCondition) {
    const version = ++searchVersion.current;
    setError("");
    try {
      const gifts = await searchGifts(condition);
      if (version === searchVersion.current) setResults(gifts);
    } catch (err) {
      if (version !== searchVersion.current) return;
      setResults(null);
      setError(`APIにつながりません：${(err as Error).message}`);
    }
  }

  function resetResults() {
    searchVersion.current++;
    setResults(null);
    setError("");
  }

  const headerContent = <header className="header"><h1>
    <Image className="giftia-logo" src="/giftia-logo.png" alt="Giftia" width={1297} height={371} unoptimized preload />
  </h1></header>;

  return (
    <main className="page standard-page">
      <StandardSearch onSearch={searchStandard} onModeChange={resetResults} headerContent={headerContent} />
      {error && <p className="summary" role="alert">{error}</p>}
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
