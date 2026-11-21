// frontendで node --test tests/*.test.mjs。実API・環境変数ファイルを使用しない。
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const require = createRequire(import.meta.url);
function load(relativePath, modules = {}, globals = {}) {
  const { outputText } = ts.transpileModule(readFileSync(new URL(relativePath, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2020 },
  });
  const exports = {};
  runInNewContext(outputText, {
    exports, require: (name) => modules[name] ?? require(name),
    URLSearchParams, process: { env: {} }, console: { log() {} }, ...globals,
  });
  return exports;
}
function descendants(node) {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap(descendants);
  return [node, ...descendants(node.props?.children)];
}
function hooks() {
  const states = [], refs = [];
  let stateIndex = 0, refIndex = 0;
  return {
    reset() { stateIndex = 0; refIndex = 0; },
    react: {
      useState(initial) {
        const index = stateIndex++;
        if (!(index in states)) states[index] = initial;
        return [states[index], (next) => { states[index] = typeof next === "function" ? next(states[index]) : next; }];
      },
      useRef(initial) {
        const index = refIndex++;
        return refs[index] ?? (refs[index] = { current: initial });
      },
    },
  };
}
function harness() {
  const urls = [], hook = hooks();
  const api = load("../lib/api.ts", {}, {
    fetch: async (url) => { urls.push(new URL(url)); return { ok: true, json: async () => ({ total: 0, results: [] }) }; },
  });
  const { default: StandardSearch } = load("../app/StandardSearch.tsx", {
    react: hook.react, "@/lib/recommendationUi": load("../lib/recommendationUi.ts"),
  });
  const render = () => { hook.reset(); return StandardSearch({ onSearch: api.searchGifts, headerContent: null, tabsContent: null }); };
  const find = (predicate) => descendants(render()).find(predicate);
  return { urls, api, find,
    submit: () => find((n) => n.type === "form").props.onSubmit({ preventDefault() {} }),
    select: (value) => find((n) => n.type === "select" && n.props.value === value),
  };
}
const settle = () => new Promise((resolve) => setImmediate(resolve));

function text(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node !== "object") return String(node);
  if (Array.isArray(node)) return node.map(text).join("");
  return text(node.props?.children);
}
const section = (h, name) => h.find((n) => n.type === "fieldset" && text(n.props.children[0]).startsWith(name));
const tag = (h, name) => h.find((n) => n.type === "button" && n.props.className?.startsWith("preference-tag") && text(n).endsWith(name));

test("条件順とシーン順を仕様どおりに表示する", () => {
  const h = harness();
  const sections = h.find((n) => n.type === "form").props.children.filter((n) => n?.type === "fieldset");
  assert.deepEqual(Array.from(sections).map((n) => text(n.props.children[0]).split(/[（ ]/)[0]),
    ["シーン", "贈る相手の年代", "贈る相手の性別", "カテゴリー", "好み", "価格帯"]);
  const scenes = descendants(section(h, "シーン")).filter((n) => n.type === "button").map((n) => n.props.children.at(-1));
  assert.deepEqual(scenes, ["送別", "取引先へのお礼", "誕生日", "お祝い", "母の日", "お歳暮", "お中元", "結婚祝い", "父の日", "出産祝い"]);
});

test("ギフトポリシーは対象シーンだけ表示し、単一選択・再クリック解除できる", () => {
  const h = harness();
  assert.equal(section(h, "ギフトポリシー"), undefined);
  tag(h, "送別").props.onClick();
  assert.ok(section(h, "ギフトポリシー"));
  assert.equal(tag(h, "王道").props["aria-pressed"], false);
  tag(h, "王道").props.onClick();
  assert.equal(tag(h, "王道").props["aria-pressed"], true);
  tag(h, "ユニーク").props.onClick();
  assert.equal(tag(h, "王道").props["aria-pressed"], false);
  assert.equal(tag(h, "ユニーク").props["aria-pressed"], true);
  tag(h, "ユニーク").props.onClick();
  assert.equal(tag(h, "ユニーク").props["aria-pressed"], false);
  tag(h, "取引先へのお礼").props.onClick();
  assert.ok(section(h, "ギフトポリシー"));
});

test("対象外シーン・シーン解除・条件クリアでポリシーを解除する", () => {
  const h = harness();
  for (const reset of [() => tag(h, "誕生日").props.onClick(), () => tag(h, "送別").props.onClick(),
    () => h.find((n) => n.props?.className === "clear-filters").props.onClick()]) {
    tag(h, "送別").props.onClick();
    tag(h, "王道").props.onClick();
    reset();
    assert.equal(section(h, "ギフトポリシー"), undefined);
    tag(h, "送別").props.onClick();
    assert.equal(tag(h, "王道").props["aria-pressed"], false);
    tag(h, "送別").props.onClick();
  }
});

test("おすすめ順の必須判定はシーンと対象シーンのポリシーだけ", () => {
  const { recommendationRequirement } = load("../lib/recommendationUi.ts");
  assert.match(recommendationRequirement("recommended", "", ""), /シーン/);
  for (const scene of ["送別", "取引先へのお礼"]) {
    assert.match(recommendationRequirement("recommended", scene, ""), /ギフトポリシー/);
    for (const policy of ["classic", "unique"]) assert.equal(recommendationRequirement("recommended", scene, policy), "");
  }
  assert.equal(recommendationRequirement("recommended", "誕生日", ""), "");
  for (const sort of ["popular", "rating", "price_asc"]) assert.equal(recommendationRequirement(sort, "", ""), "");
});

test("おすすめ順は準備中を維持し、必須不足・充足の双方でAPI送信しない", async () => {
  const h = harness();
  h.select("popular").props.onChange({ target: { value: "recommended" } });
  assert.equal(h.find((n) => n.props?.className === "search-submit").props.disabled, true);
  assert.match(text(h.find((n) => n.props?.id === "recommendation-guidance")), /シーン/);
  await h.submit(); assert.equal(h.urls.length, 0);
  tag(h, "送別").props.onClick();
  assert.match(text(h.find((n) => n.props?.id === "recommendation-guidance")), /ギフトポリシー/);
  await h.submit(); assert.equal(h.urls.length, 0);
  tag(h, "王道").props.onClick();
  assert.match(text(h.find((n) => n.props?.id === "recommendation-guidance")), /準備中/);
  await h.submit(); assert.equal(h.urls.length, 0);
});

test("既存ソートはポリシー未選択でも検索可能で、未対応パラメーターを送信しない", async () => {
  for (const sort of ["popular", "rating", "price_asc"]) {
    const h = harness();
    tag(h, "送別").props.onClick();
    h.select("popular").props.onChange({ target: { value: sort } });
    await h.submit();
    assert.equal(h.urls.length, 1);
    tag(h, "王道").props.onClick();
    await h.submit();
    const params = h.urls.at(-1).searchParams;
    for (const key of ["scene", "gift_policy", "giftPolicy", "age", "gender", "preferences"]) assert.equal(params.has(key), false);
    assert.equal(params.get("sort"), sort);
  }
});

test("初期値は月間人気順、未対応ソートは選択不可", async () => {
  const h = harness();
  assert.ok(h.select("popular"));
  assert.ok(h.select("monthly"));
  for (const value of ["recommended", "newest"]) {
    assert.equal(h.find((n) => n.type === "option" && n.props.value === value).props.disabled, true);
  }
  await h.submit();
  assert.equal(h.urls[0].searchParams.get("sort"), "popular");
  assert.equal(h.urls[0].searchParams.get("popularity_period"), "monthly");
});

test("初回検索前の変更では通信せず、初回検索で選択した期間を送る", async () => {
  const h = harness();
  h.select("monthly").props.onChange({ target: { value: "weekly" } });
  assert.equal(h.urls.length, 0);
  await h.submit();
  assert.equal(h.urls[0].searchParams.get("popularity_period"), "weekly");
});

test("並び替え・期間変更で直前の検索条件を維持し再検索する", async () => {
  const h = harness();
  h.find((n) => n.props?.type === "search").props.onChange({ target: { value: "gift sweets" } });
  const categories = descendants(h.find((n) => n.type === "form")).filter((n) => n.props?.name === "categories");
  categories[0].props.onChange({ target: { checked: true } });
  categories[1].props.onChange({ target: { checked: true } });
  h.find((n) => n.props?.type === "range").props.onInput({ currentTarget: { value: "1500" } });
  await h.submit();
  // 未適用のフォーム編集を、自動再検索へ混ぜない。
  h.find((n) => n.props?.type === "search").props.onChange({ target: { value: "unsubmitted" } });
  for (const period of ["weekly", "yearly", "all", "monthly"]) {
    const selector = h.find((n) => n.type === "select" && n.props.value !== "popular");
    selector.props.onChange({ target: { value: period } });
    await settle();
    assert.equal(h.urls.at(-1).searchParams.get("popularity_period"), period);
  }
  h.select("popular").props.onChange({ target: { value: "price_asc" } });
  await settle();
  let params = h.urls.at(-1).searchParams;
  assert.equal(params.get("sort"), "price_asc");
  assert.equal(params.has("popularity_period"), false);
  assert.equal(params.get("q"), "gift sweets");
  assert.equal(params.getAll("categories").length, 2);
  assert.equal(params.get("price_min"), "1500");
  assert.equal(params.has("price_max"), false);
  h.select("price_asc").props.onChange({ target: { value: "rating" } });
  await settle();
  params = h.urls.at(-1).searchParams;
  assert.equal(params.get("sort"), "rating");
  assert.equal(params.get("q"), "gift sweets");
});

test("クリアで月間人気順へ戻り、自動再検索を止める", async () => {
  const h = harness();
  await h.submit();
  h.select("popular").props.onChange({ target: { value: "rating" } });
  await settle();
  h.find((n) => n.props?.className === "clear-filters").props.onClick();
  assert.ok(h.select("popular"));
  assert.ok(h.select("monthly"));
  const count = h.urls.length;
  h.select("popular").props.onChange({ target: { value: "price_asc" } });
  await settle();
  assert.equal(h.urls.length, count);
});

test("旧API・取引先条件はsortを送信しない", async () => {
  const h = harness();
  await h.api.searchGifts({ keyword: "", category: "食品", indivWrap: true, priceBand: "3000" });
  const params = h.urls[0].searchParams;
  assert.equal(params.has("sort"), false);
  assert.equal(params.has("popularity_period"), false);
  assert.equal(params.get("category"), "食品");
  assert.equal(params.get("indiv_wrap"), "true");
  assert.equal(params.get("price_max"), "4999");
});

test("検索結果を古い通信の結果で上書きしない", async () => {
  const hook = hooks(), requests = [];
  function StandardSearch() {}
  function ResultCard() {}
  const { default: Home } = load("../app/page.tsx", {
    react: hook.react, "next/image": { default() {} },
    "./StandardSearch": { default: StandardSearch }, "./ResultCard": { default: ResultCard },
    "@/lib/api": { searchGifts: () => new Promise((resolve) => requests.push(resolve)) },
  });
  const render = () => { hook.reset(); return Home(); };
  const callback = () => descendants(render()).find((n) => n.type === StandardSearch).props.onSearch;
  const older = callback()({ sort: "popular" });
  const newer = callback()({ sort: "price_asc" });
  requests[1]([{ id: "new" }]); await newer;
  requests[0]([{ id: "old" }]); await older;
  assert.equal(descendants(render()).find((n) => n.type === ResultCard).props.gift.id, "new");
});
