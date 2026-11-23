"""受取人属性のペア照合・API統合を実DBなしで検証する。"""

import importlib.util
import json
import unittest
from pathlib import Path
from typing import get_args
from unittest.mock import patch

import test_recommendation as recommendation_fixture

SOURCE = Path(__file__).resolve().parents[1] / "recipient_attributes.py"
SPEC = importlib.util.spec_from_file_location("recipient_under_test", SOURCE)
recipient = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(recipient)


def entry(targets=(), preferences=()):
    return {"targets": [{"target_age": age, "target_gender": gender} for age, gender in targets],
            "preferences": list(preferences)}


PRODUCTS = {
    "G1": entry([("30代", "女性"), ("40代", "男性")], ["gourmet", "simple"]),
    "G2": entry([("20代", "男性")], ["coffee-tea"]),
    "G3": entry([("60代以上", "女性")], ["beauty"]),
    "G4": entry([("30代", "女性")], ["gourmet"]),  # 在庫なし
}


class RecipientMatchingTests(unittest.TestCase):
    def setUp(self):
        loader = patch.object(recipient, "load_recipient_products", return_value=PRODUCTS)
        self.loader = loader.start()
        self.addCleanup(loader.stop)

    def test_unspecified_does_not_load_or_filter(self):
        self.assertIsNone(recipient.matching_recipient_product_ids())
        self.assertIsNone(recipient.matching_recipient_product_ids("指定なし", "指定なし"))
        self.loader.assert_not_called()

    def test_age_or_gender_matches_existing_pairs(self):
        self.assertEqual(recipient.matching_recipient_product_ids("40代"), ["G1"])
        self.assertEqual(recipient.matching_recipient_product_ids(target_gender="男性"), ["G1", "G2"])

    def test_cross_pair_is_not_invented(self):
        self.assertEqual(recipient.matching_recipient_product_ids("30代", "男性"), [])
        self.assertEqual(recipient.matching_recipient_product_ids("40代", "男性"), ["G1"])

    def test_preferences_or_and_attributes_and(self):
        self.assertEqual(recipient.matching_recipient_product_ids(preferences=["beauty", "coffee-tea"]), ["G2", "G3"])
        self.assertEqual(recipient.matching_recipient_product_ids("20代", "男性", ["coffee-tea", "beauty"]), ["G2"])
        self.assertEqual(recipient.matching_recipient_product_ids("20代", "男性", ["beauty"]), [])

    def test_duplicate_preferences_and_unregistered_other(self):
        self.assertEqual(recipient.matching_recipient_product_ids(preferences=["simple", "simple"]), ["G1"])
        self.assertEqual(recipient.matching_recipient_product_ids(preferences=["other"]), [])


class RecipientApiTests(unittest.TestCase):
    ids = recommendation_fixture.RecommendationTests.ids

    def setUp(self):
        recommendation_fixture.RecommendationTests.setUp(self)
        # 検索APIが参照している独立モジュールの読み込み境界のみを差し替える。
        loader = patch.dict(self.module.matching_recipient_product_ids.__globals__,
                            {"load_recipient_products": lambda: PRODUCTS})
        loader.start()
        self.addCleanup(loader.stop)

    def request(self, **params):
        response = self.client.get("/api/search", params=params)
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        self.assertGreaterEqual(data["total"], len(data["results"]))
        return data

    def test_individual_attributes(self):
        for params, expected in [({"target_age": "30代"}, ["G1"]),
                                 ({"target_gender": "男性"}, ["G1", "G2"]),
                                 ({"preferences": "beauty"}, ["G3"])]:
            with self.subTest(params=params):
                data = self.request(**params)
                self.assertEqual(self.ids(data), expected)
                self.assertEqual(data["total"], len(expected))

    def test_preferences_or_and_pair_and(self):
        data = self.request(preferences=["beauty", "coffee-tea"])
        self.assertEqual(set(self.ids(data)), {"G2", "G3"})
        self.assertEqual(self.ids(self.request(target_age="20代", target_gender="男性",
                                             preferences=["beauty", "coffee-tea"])), ["G2"])
        self.assertEqual(self.request(target_age="30代", target_gender="男性")["total"], 0)

    def test_unspecified_includes_untagged_but_specified_excludes_them(self):
        self.assertIn("G5", self.ids(self.request()))
        self.assertEqual(self.request(target_age="指定なし", target_gender="指定なし")["total"], 4)
        self.assertNotIn("G5", self.ids(self.request(preferences="simple")))

    def test_zero_never_relaxes_conditions(self):
        for params in [{"preferences": "other"}, {"target_age": "20代", "preferences": "beauty"}]:
            self.assertEqual(self.request(**params), {"total": 0, "results": []})

    def test_filters_count_and_limit_before_ranking(self):
        for sort in [None, "popular", "rating", "price_asc"]:
            params = {"preferences": ["beauty", "coffee-tea"], "limit": 1}
            if sort:
                params["sort"] = sort
            data = self.request(**params)
            self.assertEqual(data["total"], 2)
            self.assertEqual(len(data["results"]), 1)
            filtered = self.request(**{**params, "q": "コーヒー", "categories": ["飲料", "食品"],
                                       "price_min": 3000, "price_max": 3000, "scene": "誕生日"})
            self.assertEqual(self.ids(filtered), ["G2"])
            self.assertEqual(filtered["total"], 1)

    def test_recommendation_filter_before_limit_keeps_scores_and_reasons(self):
        for policy in ["classic", "unique"]:
            base = {"sort": "recommend", "scene": "送別", "gift_policy": policy}
            original = next(g for g in self.request(**base)["results"] if g["id"] == "G3")
            data = self.request(**base, preferences="beauty", limit=1)
            self.assertEqual(data["total"], 1)
            self.assertEqual(data["results"], [original])
            self.assertEqual(self.request(**base, preferences="other")["total"], 0)

    def test_recommendation_group_priority_survives_filtering(self):
        with patch.dict(PRODUCTS, {"G5": entry(preferences=["beauty"])}):
            for policy, expected in [("classic", ["G1", "G5", "G3"]),
                                     ("unique", ["G3", "G5", "G1"])]:
                data = self.request(sort="recommend", scene="送別", gift_policy=policy,
                                    preferences=["gourmet", "beauty"])
                self.assertEqual(self.ids(data), expected)
                self.assertEqual(data["total"], 3)
                self.assertEqual([g["recommendation"]["group"] for g in data["results"]],
                                 ["match", "untagged", "opposite"])

    def test_real_manifest_filters_all_rows_before_simple_limit(self):
        real_products = recipient.load_recipient_products()
        for pid in real_products:
            self.db.execute("INSERT INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                            (pid, "デモ", "", "商品", "", 500, 1, 0, None, 0))
        expected = recipient.matching_recipient_product_ids(preferences=["gourmet", "beauty"])
        with patch.dict(self.module.matching_recipient_product_ids.__globals__,
                        {"load_recipient_products": lambda: real_products}):
            data = self.request(preferences=["gourmet", "beauty"], limit=1)
        self.assertEqual(data["total"], len(expected))
        self.assertEqual(data["total"], 35)
        self.assertEqual(len(data["results"]), 1)
        self.assertIn(data["results"][0]["id"], expected)

    def test_invalid_attributes_rejected_before_sql(self):
        for params in [{"target_age": "10代"}, {"target_gender": "unknown"},
                       {"preferences": "unknown"}, {"preferences": ["beauty", "x' OR 1=1 --"]}]:
            self.queries.clear()
            self.assertEqual(self.client.get("/api/search", params=params).status_code, 422)
            self.assertEqual(self.queries, [])

    def test_matched_ids_are_parameters_not_sql(self):
        self.request(preferences="gourmet")
        for sql, params in self.queries:
            self.assertIn("p.product_id IN (%s, %s)", sql)
            self.assertNotIn("G1", sql)
            self.assertIn("G1", params)
            self.assertIn("G4", params)  # WHERE stock > 0 で在庫なしを除外


class RecipientManifestTests(unittest.TestCase):
    def test_manifest_ids_evidence_and_migration_shape(self):
        manifest = json.loads(recipient.ATTRIBUTES_PATH.read_text(encoding="utf-8"))
        self.assertEqual(manifest["source"], "demo_curated")
        self.assertEqual(len(manifest["products"]), 152)
        self.assertEqual(set(manifest["preference_master"]), set(get_args(recipient.PreferenceId)))
        for pid, item in manifest["products"].items():
            self.assertRegex(pid, r"^G\d{4}$")
            self.assertEqual(item["source"], "demo_curated")
            self.assertEqual(len(item["preferences"]), len(set(item["preferences"])))
            for pref in item["preferences"]:
                self.assertIn(pref, get_args(recipient.PreferenceId))
                self.assertTrue(item["preference_evidence"][pref]["quote"])
            pairs = set()
            for target in item["targets"]:
                pair = (target["target_age"], target["target_gender"])
                self.assertNotIn(pair, pairs)
                pairs.add(pair)
                self.assertIn(pair[0], get_args(recipient.TargetAge)[2:])
                self.assertIn(pair[1], ["男性", "女性"])
                self.assertTrue(target["evidence"])
            self.assertTrue(item["targets"] or item["preferences"])
