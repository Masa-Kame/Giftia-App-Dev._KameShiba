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
    exports, require: (name) => modules[name] ?? (name === "@/lib/searchSession" ? {
      loadSavedSearch: () => null, useIsClient: () => true,
      clearSavedSearch() {}, saveSearchForm() {}, saveSearchResults() {}, saveSearchScroll() {},
    } : require(name)),
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
      useEffect() {},
      useState(initial) {
        const index = stateIndex++;
        if (!(index in states)) states[index] = typeof initial === "function" ? initial() : initial;
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
  let resetCount = 0;
  const render = () => { hook.reset(); return StandardSearch({ onSearch: api.searchGifts, onModeChange: () => resetCount++, headerContent: null }); };
  const find = (predicate) => descendants(render()).find(predicate);
  return { urls, api, find, resetCount: () => resetCount,
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
const switchMode = (h, name) => h.find((n) => n.type === "button" && text(n) === name).props.onClick();

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
  switchMode(h, "おまかせで探す");
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
  switchMode(h, "おまかせで探す");
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

test("おすすめ検索は必須不足を止め、送別とポリシーが揃ったらAPI送信する", async () => {
  const h = harness();
  switchMode(h, "おまかせで探す");
  assert.equal(h.find((n) => n.props?.className === "search-submit").props.disabled, true);
  assert.match(text(h.find((n) => n.props?.id === "recommendation-guidance")), /シーン/);
  await h.submit(); assert.equal(h.urls.length, 0);
  tag(h, "送別").props.onClick();
  assert.equal(h.find((n) => n.props?.id === "recommendation-guidance"), undefined);
  await h.submit(); assert.equal(h.urls.length, 0);
  tag(h, "王道").props.onClick();
  assert.equal(h.find((n) => n.props?.className === "search-submit").props.disabled, false);
  await h.submit(); assert.equal(h.urls.length, 1);
  assert.equal(h.urls[0].searchParams.get("sort"), "recommend");
  assert.equal(h.urls[0].searchParams.get("scene"), "送別");
  assert.equal(h.urls[0].searchParams.get("gift_policy"), "classic");
  tag(h, "ユニーク").props.onClick(); await settle();
  assert.equal(h.urls.at(-1).searchParams.get("gift_policy"), "unique");
  tag(h, "誕生日").props.onClick();
  assert.equal(h.find((n) => n.props?.className === "search-submit").props.disabled, true);
  assert.match(text(h.find((n) => n.props?.id === "recommendation-guidance")), /送別シーンのみ/);
});

test("既存ソートはポリシー未選択でも検索可能で、未対応パラメーターを送信しない", async () => {
  for (const sort of ["popular", "rating", "price_asc"]) {
    const h = harness();
    h.select("popular").props.onChange({ target: { value: sort } });
    await h.submit();
    assert.equal(h.urls.length, 1);
    assert.equal(section(h, "ギフトポリシー"), undefined);
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
  assert.equal(h.find((n) => n.type === "option" && n.props.value === "recommended"), undefined);
  assert.equal(h.find((n) => n.type === "option" && n.props.value === "newest").props.disabled, true);
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
  h.find((n) => n.props?.name === "categories" && n.props.value === categories[1].props.value).props.onChange({ target: { checked: true } });
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

test("旧APIの個包装・価格帯パラメーター互換性を維持する", async () => {
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

test("2モードの切り替えは入力条件を保持し、結果リセットを通知する", async () => {
  const h = harness();
  h.find((n) => n.props?.type === "search").props.onChange({ target: { value: "コーヒー" } });
  tag(h, "送別").props.onClick();
  h.find((n) => n.props?.name === "categories").props.onChange({ target: { checked: true } });
  h.find((n) => n.props?.type === "range").props.onChange({ currentTarget: { value: "1500" } });
  await h.submit();
  switchMode(h, "おまかせで探す");
  assert.equal(h.resetCount(), 1);
  assert.equal(h.find((n) => n.props?.type === "search").props.value, "コーヒー");
  assert.equal(tag(h, "送別").props["aria-pressed"], true);
  assert.equal(h.find((n) => n.props?.name === "categories").props.checked, true);
  assert.equal(h.find((n) => n.props?.type === "range").props.value, 1500);
  tag(h, "王道").props.onClick();
  switchMode(h, "自分で探す");
  assert.equal(section(h, "ギフトポリシー"), undefined);
  const count = h.urls.length;
  h.select("popular").props.onChange({ target: { value: "rating" } });
  await settle();
  assert.equal(h.urls.length, count); // モード変更前の検索条件では自動検索しない。
  switchMode(h, "おまかせで探す");
  assert.equal(tag(h, "王道").props["aria-pressed"], true);
});

test("受取人属性は両モードで選択でき、APIに送信する", async () => {
  const h = harness();
  for (const mode of ["自分で探す", "おまかせで探す"]) {
    switchMode(h, mode);
    for (const name of ["贈る相手の年代", "贈る相手の性別", "好み"]) {
      const field = section(h, name);
      assert.notEqual(field.props.disabled, true);
      assert.doesNotMatch(text(field.props.children[0]), /デモ属性/);
    }
    for (const [name, value] of [["age", "30代"], ["gender", "女性"]]) {
      h.find((n) => n.props?.name === name && n.props.value === value).props.onChange();
      const input = h.find((n) => n.props?.name === name && n.props.value === value);
      assert.equal(input.props.checked, true);
      assert.match(h.find((n) => n.type === "label" && n.props.children?.[0]?.props?.name === name && n.props.children[0].props.value === value).props.className, /selected/);
    }
    const preference = () => h.find((n) => n.props?.name === "preferences" && n.props.value === "travel");
    preference().props.onChange({ target: { checked: true } });
    assert.equal(preference().props.checked, true);
    assert.match(h.find((n) => n.type === "label" && n.props.children?.[0]?.props?.name === "preferences" && n.props.children[0].props.value === "travel").props.className, /selected/);
  }
  switchMode(h, "自分で探す");
  await h.submit();
  assert.equal(h.urls.at(-1).searchParams.get("target_age"), "30代");
  assert.equal(h.urls.at(-1).searchParams.get("target_gender"), "女性");
  assert.deepEqual(h.urls.at(-1).searchParams.getAll("preferences"), ["travel"]);
  h.find((n) => n.props?.className === "clear-filters").props.onClick();
  assert.equal(h.find((n) => n.props?.name === "preferences" && n.props.value === "travel").props.checked, false);
  for (const name of ["age", "gender"]) assert.equal(h.find((n) => n.props?.name === name && n.props.value === "指定なし").props.checked, true);
  await h.submit();
  for (const key of ["target_age", "target_gender", "preferences"]) assert.equal(h.urls.at(-1).searchParams.has(key), false);
});

test("好みの複数指定を重複なく送信し、折りたたみ・並び替えでも適用条件を保持する", async () => {
  const h = harness();
  const preference = (value) => h.find((n) => n.props?.name === "preferences" && n.props.value === value);
  for (const value of ["gourmet", "beauty", "beauty"]) preference(value).props.onChange({ target: { checked: true } });
  h.find((n) => n.props?.name === "age" && n.props.value === "30代").props.onChange();
  h.find((n) => n.props?.className === "preferences-toggle").props.onClick();
  h.find((n) => n.props?.className === "preferences-toggle").props.onClick();
  await h.submit();
  assert.deepEqual(h.urls.at(-1).searchParams.getAll("preferences"), ["gourmet", "beauty"]);
  // 未検索の編集は、直前に適用済みの条件を用いるシンプル検索のソートには混ぜない。
  preference("beauty").props.onChange({ target: { checked: false } });
  h.select("popular").props.onChange({ target: { value: "price_asc" } });
  await settle();
  assert.deepEqual(h.urls.at(-1).searchParams.getAll("preferences"), ["gourmet", "beauty"]);
  assert.equal(h.urls.at(-1).searchParams.get("target_age"), "30代");
  await h.submit();
  assert.deepEqual(h.urls.at(-1).searchParams.getAll("preferences"), ["gourmet"]);
});

test("おすすめ検索は属性変更で再検索し、同じポリシーと検索条件を維持する", async () => {
  const h = harness();
  switchMode(h, "おまかせで探す");
  tag(h, "送別").props.onClick(); tag(h, "王道").props.onClick();
  await h.submit();
  for (const [name, value, parameter] of [["age", "30代", "target_age"], ["gender", "女性", "target_gender"]]) {
    const before = h.urls.length;
    h.find((n) => n.props?.name === name && n.props.value === value).props.onChange();
    await settle();
    assert.equal(h.urls.length, before + 1);
    assert.equal(h.urls.at(-1).searchParams.get(parameter), value);
    assert.equal(h.urls.at(-1).searchParams.get("gift_policy"), "classic");
  }
  h.find((n) => n.props?.name === "preferences" && n.props.value === "gourmet").props.onChange({ target: { checked: true } });
  await settle();
  assert.deepEqual(h.urls.at(-1).searchParams.getAll("preferences"), ["gourmet"]);
  assert.equal(h.urls.at(-1).searchParams.get("target_age"), "30代");
  assert.equal(h.urls.at(-1).searchParams.get("target_gender"), "女性");
});

test("0件のときは条件解除を案内し、自動的な再検索を行わない", async () => {
  const hook = hooks();
  function StandardSearch() {}
  const calls = [];
  const { default: Home } = load("../app/page.tsx", {
    react: hook.react, "next/image": { default() {} },
    "./StandardSearch": { default: StandardSearch }, "./ResultCard": { default() {} },
    "@/lib/api": { searchGifts: async (condition) => { calls.push(condition); return []; } },
  });
  const render = () => { hook.reset(); return Home(); };
  const form = descendants(render()).find((n) => n.type === StandardSearch);
  await form.props.onSearch({ preferences: ["other"] });
  assert.equal(calls.length, 1);
  const guidance = descendants(render()).find((n) => n.props?.role === "status");
  assert.match(text(guidance), /条件に一致する商品がありません/);
  assert.match(text(guidance), /条件を解除/);
});

test("DB対応未確認のシーンを無視して検索しない", async () => {
  const h = harness();
  assert.equal(tag(h, "取引先へのお礼").props.disabled, true);
  assert.equal(tag(h, "お祝い").props.disabled, true);
  switchMode(h, "おまかせで探す");
  tag(h, "取引先へのお礼").props.onClick();
  switchMode(h, "自分で探す");
  assert.equal(h.find((n) => n.props?.className === "search-submit").props.disabled, true);
  assert.match(text(h.find((n) => n.props?.id === "scene-verification-guidance")), /未確定/);
  await h.submit(); assert.equal(h.urls.length, 0);
  tag(h, "取引先へのお礼").props.onClick();
  await h.submit(); assert.equal(h.urls.length, 1);
});

test("確認済み8シーンを同名で送信し、並び替えでも保持する", async () => {
  for (const scene of ["送別", "誕生日", "母の日", "お歳暮", "お中元", "結婚祝い", "父の日", "出産祝い"]) {
    const h = harness();
    tag(h, scene).props.onClick();
    await h.submit();
    assert.equal(h.urls[0].searchParams.get("scene"), scene);
    h.select("popular").props.onChange({ target: { value: "price_asc" } });
    await settle();
    assert.equal(h.urls.at(-1).searchParams.get("scene"), scene);
    assert.equal(h.urls.at(-1).searchParams.get("sort"), "price_asc");
  }
});

test("おすすめ検索後の条件変更を再取得し、必須解除・モード変更では停止する", async () => {
  const h = harness();
  switchMode(h, "おまかせで探す"); tag(h, "送別").props.onClick(); tag(h, "王道").props.onClick();
  assert.equal(h.urls.length, 0);
  await h.submit();
  h.find((n) => n.props?.type === "search").props.onChange({ target: { value: "コーヒー" } }); await settle();
  assert.equal(h.urls.at(-1).searchParams.get("q"), "コーヒー");
  h.find((n) => n.props?.name === "categories").props.onChange({ target: { checked: true } }); await settle();
  assert.equal(h.urls.at(-1).searchParams.get("categories"), "食品");
  const range = h.find((n) => n.props?.type === "range");
  const before = h.urls.length;
  range.props.onInput({ currentTarget: { value: "1500" } });
  range.props.onChange({ currentTarget: { value: "1500" } }); await settle();
  assert.equal(h.urls.length, before + 1);
  assert.equal(h.urls.at(-1).searchParams.get("price_min"), "1500");
  tag(h, "王道").props.onClick(); await settle();
  const count = h.urls.length;
  await h.submit(); assert.equal(h.urls.length, count);
  tag(h, "王道").props.onClick(); await settle();
  assert.equal(h.urls.length, count + 1);
  switchMode(h, "自分で探す");
  await h.submit();
  assert.equal(h.urls.at(-1).searchParams.get("sort"), "popular");
  assert.equal(h.urls.at(-1).searchParams.has("gift_policy"), false);
});

test("モード変更は結果・エラーを消去し、保留中の成功・失敗を無効化する", async () => {
  const hook = hooks(), requests = [];
  function StandardSearch() {}
  function ResultCard() {}
  const { default: Home } = load("../app/page.tsx", {
    react: hook.react, "next/image": { default() {} },
    "./StandardSearch": { default: StandardSearch }, "./ResultCard": { default: ResultCard },
    "@/lib/api": { searchGifts: () => new Promise((resolve, reject) => requests.push({ resolve, reject })) },
  });
  const render = () => { hook.reset(); return Home(); };
  const form = () => descendants(render()).find((n) => n.type === StandardSearch);
  const first = form().props.onSearch({});
  requests[0].resolve([{ id: "existing" }]); await first;
  assert.ok(descendants(render()).find((n) => n.type === ResultCard));
  const stale = form().props.onSearch({});
  form().props.onModeChange();
  assert.equal(descendants(render()).find((n) => n.type === ResultCard), undefined);
  requests[1].resolve([{ id: "stale" }]); await stale;
  assert.equal(descendants(render()).find((n) => n.type === ResultCard), undefined);
  const failed = form().props.onSearch({});
  requests[2].reject(new Error("failure")); await failed;
  assert.ok(descendants(render()).find((n) => n.props?.role === "alert"));
  const staleError = form().props.onSearch({});
  form().props.onModeChange();
  requests[3].reject(new Error("old failure")); await staleError;
  assert.equal(descendants(render()).find((n) => n.props?.role === "alert"), undefined);
});
