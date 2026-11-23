// 実行: frontendで node --test tests/result-card.test.mjs
// TSXをメモリ上で変換し、本物のNext.js LinkのHTMLを検証する。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import Link from "next/link.js";

const require = createRequire(import.meta.url);

const { outputText } = ts.transpileModule(
  readFileSync(new URL("../app/ResultCard.tsx", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
);
const componentExports = {};
runInNewContext(outputText, { exports: componentExports, require });
const ResultCard = componentExports.default;
const gift = {
  id: "G0001", category: "食品", brand: "Giftia", name: "ギフトセット",
  price: 1500, rating: 4.5, reviewCount: 12,
};

test("カード全体が実際の商品IDを使ったNext.js Linkになる", () => {
  const card = ResultCard({ gift, rank: 1 });
  assert.equal(card.type, Link.default ?? Link);
  const html = renderToStaticMarkup(card);
  assert.match(html, /^<a\b/);
  assert.match(html, /href="\/products\/G0001"/);
  assert.match(html, /aria-label="ギフトセットの商品詳細を見る"/);
  assert.equal((html.match(/<a\b/g) ?? []).length, 1);
  assert.doesNotMatch(html, /<button\b|tabindex="-1"/);
  assert.match(html, /1位・食品・Giftia/);
  assert.match(html, /<h3[^>]*>ギフトセット<\/h3>/);
  assert.match(html, /1,500円/);
  assert.match(html, /評価4.5 \(12件）/);
});

test("商品ごとにリンク先が変わる", () => {
  assert.equal(ResultCard({ gift: { ...gift, id: "G0002" }, rank: 2 }).props.href, "/products/G0002");
  assert.equal(ResultCard({ gift, rank: 1 }).props.href, "/products/G0001");
});

test("商品IDの予約文字・日本語をURLエンコードする", () => {
  const id = "商品 A?#";
  const card = ResultCard({ gift: { ...gift, id }, rank: 1 });
  assert.equal(card.props.href, `/products/${encodeURIComponent(id)}`);
  assert.equal(decodeURIComponent(card.props.href.slice("/products/".length)), id);
});

test("理由は特徴・購入実績の最大2件、出典は利用者向けの表現で表示する", () => {
  const recommendation = { group: "match", reasons: [
    { source: "database", kind: "purchase", text: "送別目的で68個の購入実績があります" },
    { source: "demo_curated", kind: "feature", text: "飲み比べの楽しみを贈れます" },
    { source: "demo_curated", kind: "feature", text: "重複する特徴" },
    { source: "database", text: "送別シーンに対応した商品" },
    { source: "database", text: "購入者から高い評価を得ています" },
  ] };
  const html = renderToStaticMarkup(ResultCard({ gift: { ...gift, recommendation }, rank: 1 }));
  assert.match(html, /商品の特徴/); assert.match(html, /購入実績/);
  assert.doesNotMatch(html, /デモ用の紹介文/);
  assert.equal((html.match(/<li>/g) ?? []).length, 2);
  assert.ok(html.indexOf("飲み比べの楽しみ") < html.indexOf("送別目的で68個"));
  assert.doesNotMatch(html, /重複する特徴|送別シーンに対応した商品|購入者から高い評価|DBデータ|デモ属性|ポリシー一致|ポリシー未付与|反対ポリシー/);
  assert.match(html, /href="\/products\/G0001"/);
  assert.match(html, /評価4.5 \(12件）/);
});

test("理由なし・自分で探す・旧形式の理由だけの場合は理由欄を表示しない", () => {
  for (const recommendation of [undefined, { reasons: [] }, { reasons: [
    { source: "database", text: "送別シーンに対応した商品" },
    { source: "database", text: "購入者から高い評価を得ています" },
  ] }]) {
    const html = renderToStaticMarkup(ResultCard({ gift: { ...gift, recommendation }, rank: 1 }));
    assert.doesNotMatch(html, /おすすめ理由|商品の特徴|購入実績|デモ用の紹介文/);
    assert.match(html, /評価4.5/);
  }
});

test("特徴のみ・購入実績のみも表示し、デモ注記は表示しない", () => {
  for (const kind of ["feature", "purchase"]) {
    const recommendation = { group: "opposite", reasons: [{
      source: kind === "feature" ? "demo_curated" : "database", kind, text: "理由本文",
    }] };
    const html = renderToStaticMarkup(ResultCard({ gift: { ...gift, recommendation }, rank: 1 }));
    assert.equal((html.match(/<li>/g) ?? []).length, 1);
    assert.match(html, /おすすめ理由/);
    assert.doesNotMatch(html, /デモ用の紹介文/);
    assert.doesNotMatch(html, /反対ポリシー/);
  }
});
