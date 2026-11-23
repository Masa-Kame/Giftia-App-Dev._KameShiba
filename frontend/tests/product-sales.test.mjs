import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const { outputText } = ts.transpileModule(
  readFileSync(new URL("../components/ProductPurchase.tsx", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } },
);
const componentExports = {};
runInNewContext(outputText, { exports: componentExports,
  require: (name) => name.endsWith(".module.css") ? { default: {} } : require(name),
});
const product = { product_name: "ギフト", brand: "Giftia", price: 1000, stock: 10,
  rating: 4.5, sales_count: 99999, gift_wrap: false, message_card: false };
function render(changes) {
  return renderToStaticMarkup(createElement(componentExports.default, {
    product: { ...product, ...changes }, reviewTotal: 5, isFavorite: false,
    onAddToCart() {}, onBuyNow() {}, onToggleFavorite() {},
  }));
}

test("注文集計の購入数量と対象期間を表示し、従来の保存値は表示しない", () => {
  const html = render({ recent_year_sales_count: 1234,
    sales_period_start: "2025-07-01", sales_period_end: "2026-06-30" });
  assert.match(html, /直近1年（2025\/07\/01〜2026\/06\/30）で 1,234 個 購入されています/);
  assert.doesNotMatch(html, /99,999/);
  assert.match(html, /4\.5/);
});

test("購入数量0件・未取得時は保存値へフォールバックしない", () => {
  for (const value of [0, undefined, null]) {
    assert.doesNotMatch(render({ recent_year_sales_count: value,
      sales_period_start: "2025-07-01", sales_period_end: "2026-06-30" }), /直近1年|購入されています/);
  }
});

test("集計期間がない旧APIレスポンスでは期間付き購入実績を表示しない", () => {
  assert.doesNotMatch(render({ recent_year_sales_count: 1234 }), /直近1年|購入されています/);
});
