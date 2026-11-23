"""Recommendation SQL and ranking tests, without dotenv or MySQL."""

import json
import math
import unittest
from unittest.mock import Mock

import test_search as search_fixture


class RecommendationTests(unittest.TestCase):
    ids = search_fixture.SearchApiTests.ids

    def setUp(self):
        search_fixture.SearchApiTests.setUp(self)
        self.real_manifest = self.module.DEMO_ATTRIBUTES_PATH
        self.db.executescript("""
            CREATE TABLE orders (order_id TEXT PRIMARY KEY, ordered_at TEXT, gift_purpose TEXT);
            CREATE TABLE order_items (order_id TEXT, product_id TEXT, quantity INTEGER);
            CREATE TABLE reviews (product_id TEXT, rating REAL);
            INSERT INTO product_scenes VALUES ('G3', '送別');
            INSERT INTO orders VALUES ('a', '2026-06-30 23:59:59', '送別');
            INSERT INTO orders VALUES ('b', '2026-07-01 00:00:00', '送別');
            INSERT INTO orders VALUES ('c', '2026-06-30 12:00:00', '誕生日');
            INSERT INTO order_items VALUES ('a', 'G1', 2), ('a', 'G5', 100), ('a', 'G4', 779);
            INSERT INTO order_items VALUES ('b', 'G1', 999), ('c', 'G1', 900);
        """)
        self.db.executemany("INSERT INTO reviews VALUES (?, ?)", [("G1", 5)] * 5 + [("G2", 1)])
        self.module.DEMO_ATTRIBUTES_PATH = Mock()
        # main.py はファイルの更新日時が変わるまで読み込み結果を使い回すので、日時も用意する
        self.module.DEMO_ATTRIBUTES_PATH.stat.return_value.st_mtime_ns = 1
        self.module.DEMO_ATTRIBUTES_PATH.read_text.return_value = json.dumps({"products": [
            {"product_id": "G1", "scene": "送別", "policy": "classic", "reason": "定番の菓子", "source": "demo_curated"},
            {"product_id": "G3", "scene": "送別", "policy": "unique", "reason": "特徴的な意匠", "source": "demo_curated"},
        ]})

    def request(self, policy="classic", **params):
        self.queries.clear()
        response = self.client.get("/api/search", params={
            "sort": "recommend", "scene": "送別", "gift_policy": policy, **params,
        })
        self.assertEqual(response.status_code, 200, response.text)
        return response.json()

    def test_group_priority_and_policy_switch_before_limit(self):
        classic = self.request()
        self.assertEqual(classic["total"], 3)
        self.assertEqual(self.ids(classic), ["G1", "G5", "G3"])
        self.assertEqual([r["recommendation"]["group"] for r in classic["results"]], ["match", "untagged", "opposite"])
        self.assertEqual(self.ids(self.request("unique")), ["G3", "G5", "G1"])
        self.assertEqual(self.ids(self.request("unique", limit=1)), ["G3"])

    def test_filters_and_existence_do_not_duplicate_rows(self):
        data = self.request(categories=["食品", "飲料"], price_min=2000, price_max=4500)
        self.assertEqual(data["total"], 1)
        self.assertEqual(self.ids(data), ["G5"])
        self.assertEqual(self.ids(self.request(q="送別 お菓子", indiv_wrap=True)), ["G1"])
        self.assertNotIn("G4", self.ids(self.request()))
        self.assertNotIn("G2", self.ids(self.request()))

    def test_purchase_bounds_quantity_bayes_and_components(self):
        gift = self.request()["results"][0]
        rec = gift["recommendation"]
        c = 26 / 6
        b = (25 + 10 * c) / 15
        self.assertEqual(rec["purchaseQuantity"], 2)
        self.assertEqual(rec["validReviewCount"], 5)
        self.assertAlmostEqual(rec["bayesianRating"], b)
        self.assertAlmostEqual(rec["components"]["purchase"], 30 * math.log(3) / math.log(780))
        self.assertAlmostEqual(rec["components"]["review"], 20 * (b - 1) / 4)
        self.assertAlmostEqual(rec["score"], sum(rec["components"].values()))
        self.assertEqual(gift["rating"], 4.5)  # Displayed product rating remains unchanged.

    def test_zero_purchase_and_reviews_keep_prior(self):
        rec = next(g["recommendation"] for g in self.request()["results"] if g["id"] == "G3")
        self.assertEqual(rec["purchaseQuantity"], 0)
        self.assertEqual(rec["validReviewCount"], 0)
        self.assertAlmostEqual(rec["bayesianRating"], 26 / 6)
        self.assertEqual(rec["components"]["purchase"], 0)

    def test_no_valid_reviews_or_sales_and_stable_id_ties(self):
        self.db.execute("DELETE FROM reviews")
        self.db.execute("DELETE FROM order_items")
        self.module.DEMO_ATTRIBUTES_PATH.read_text.return_value = '{"products": []}'
        data = self.request()
        self.assertEqual(self.ids(data), ["G1", "G3", "G5"])
        for gift in data["results"]:
            rec = gift["recommendation"]
            self.assertIsNone(rec["bayesianRating"])
            self.assertEqual(rec["components"]["review"], 0)
            self.assertEqual(rec["components"]["purchase"], 0)
            self.assertEqual(rec["reasons"], [])

    def test_valid_reviews_only_and_existing_products_only(self):
        before = self.request()["results"][0]["recommendation"]
        self.db.executemany("INSERT INTO reviews VALUES (?, ?)", [("G1", None), ("G1", 0), ("G1", 6), ("missing", 1)])
        after = self.request()["results"][0]["recommendation"]
        self.assertEqual(before["bayesianRating"], after["bayesianRating"])
        self.assertEqual(before["validReviewCount"], after["validReviewCount"])

    def test_reasons_features_then_purchases_and_missing_cases(self):
        rec = self.request()["results"][0]["recommendation"]
        self.assertEqual([r["kind"] for r in rec["reasons"]], ["feature", "purchase"])
        self.assertEqual([r["source"] for r in rec["reasons"]], ["demo_curated", "database"])
        self.assertEqual(rec["reasons"][1]["text"], "送別目的で2個の購入実績があります")
        # 反対ポリシーでも、商品の特徴そのものは紹介する。
        opposite = next(g["recommendation"] for g in self.request()["results"] if g["id"] == "G3")
        self.assertEqual([r["kind"] for r in opposite["reasons"]], ["feature"])
        untagged = next(g["recommendation"] for g in self.request()["results"] if g["id"] == "G5")
        self.assertEqual([r["kind"] for r in untagged["reasons"]], ["purchase"])
        self.db.execute("DELETE FROM order_items")
        self.module.DEMO_ATTRIBUTES_PATH.stat.return_value.st_mtime_ns = 2  # ファイルが更新された想定
        self.module.DEMO_ATTRIBUTES_PATH.read_text.return_value = '{"products": []}'
        self.assertTrue(all(not g["recommendation"]["reasons"] for g in self.request()["results"]))

    def test_purchase_quantity_format_and_no_scene_or_review_reasons(self):
        self.db.execute("UPDATE order_items SET quantity = 1234 WHERE order_id = 'a' AND product_id = 'G1'")
        self.db.executemany("INSERT INTO reviews VALUES (?, ?)", [("G5", 5)] * 5)
        data = self.request()
        for g in data["results"]:
            reasons = g["recommendation"]["reasons"]
            self.assertLessEqual(len(reasons), 2)
            self.assertTrue(all(r["kind"] in ("feature", "purchase") for r in reasons))
            self.assertFalse(any("シーンに対応した商品" in r["text"] or "高い評価" in r["text"] for r in reasons))
        first = next(g for g in data["results"] if g["id"] == "G1")
        self.assertEqual(first["recommendation"]["reasons"][1]["text"], "送別目的で1,234個の購入実績があります")

    def test_score_sort_within_groups(self):
        self.module.DEMO_ATTRIBUTES_PATH.read_text.return_value = '{"products": []}'
        self.assertEqual(self.ids(self.request()), ["G5", "G1", "G3"])

    def test_review_scores_remain_without_review_reasons(self):
        self.db.execute("DELETE FROM reviews")
        self.db.executemany("INSERT INTO reviews VALUES (?, ?)", [("G5", 4)] * 4)
        def reason_texts():
            rec = next(g["recommendation"] for g in self.request()["results"] if g["id"] == "G5")
            return [r["text"] for r in rec["reasons"]]
        self.assertNotIn("購入者から高い評価を得ています", reason_texts())
        self.db.execute("INSERT INTO reviews VALUES ('G5', 4)")
        self.assertNotIn("購入者から高い評価を得ています", reason_texts())
        self.db.execute("UPDATE reviews SET rating = 3")
        self.assertNotIn("購入者から高い評価を得ています", reason_texts())

    def test_invalid_recommendation_parameters_rejected_before_sql(self):
        for overrides in ({"scene": ""}, {"scene": "誕生日"}, {"scene": "取引先へのお礼"},
                          {"scene": "お祝い"}, {"gift_policy": ""}, {"gift_policy": "x' OR 1=1 --"}):
            self.queries.clear()
            response = self.client.get("/api/search", params={"sort": "recommend", "scene": "送別", "gift_policy": "classic", **overrides})
            self.assertEqual(response.status_code, 422)
            self.assertEqual(self.queries, [])
        self.assertEqual(self.client.get("/api/search", params={"sort": "recommend", "scene": "送別"}).status_code, 422)

    def test_injection_bound_as_data(self):
        value = "食品') OR 1=1 --"
        self.assertEqual(self.request(categories=[value])["total"], 0)
        for query, params in self.queries:
            self.assertNotIn(value, query)
            self.assertIn(value, params)

    def test_simple_search_does_not_load_demo_attributes(self):
        self.client.get("/api/search")
        self.module.DEMO_ATTRIBUTES_PATH.read_text.assert_not_called()

    def test_approved_manifest(self):
        data = json.loads(self.real_manifest.read_text(encoding="utf-8"))
        rows = data["products"]
        self.assertEqual(len(rows), 40)
        self.assertEqual(len({r["product_id"] for r in rows}), 40)
        self.assertEqual(sum(r["policy"] == "classic" for r in rows), 20)
        self.assertEqual(sum(r["policy"] == "unique" for r in rows), 20)
        self.assertTrue(all(r["scene"] == "送別" and r["source"] == "demo_curated" and r["reason"] and r["evidence"] for r in rows))
        unique_ids = {r["product_id"] for r in rows if r["policy"] == "unique"}
        self.assertTrue({"G0060", "G0125", "G0005", "G0349"}.issubset(unique_ids))
        self.assertFalse({"G0460", "G0759", "G4284", "G3261"} & unique_ids)
