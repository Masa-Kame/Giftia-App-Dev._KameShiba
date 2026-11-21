"""DB接続・環境変数ファイル読み込みなしで検索APIの互換性を確認する。

実行: python -B -m unittest discover -s backend/tests -v
SQLをSQLiteのインメモリDBで実行し、MySQLとの実接続は行わない。
"""

import sqlite3
import types
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

from fastapi import APIRouter
from fastapi.testclient import TestClient


class SearchApiTests(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(":memory:", check_same_thread=False)
        self.addCleanup(self.db.close)
        self.db.row_factory = sqlite3.Row
        self.db.execute("""CREATE TABLE products (
            product_id TEXT, category TEXT, brand TEXT, product_name TEXT,
            description TEXT, price INTEGER, stock INTEGER, sales_count INTEGER,
            rating REAL, review_count INTEGER
        )""")
        self.db.executemany(
            "INSERT INTO products VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            [
                ("G1", "食品", "A", "送別 お菓子", "個包装", 1500, 10, 100, 4.5, 5),
                ("G2", "飲料", "B", "送別 コーヒー", "個包装", 3000, 10, 90, 4.0, 3),
                ("G3", "コスメ", "C", "ハンドクリーム", "ギフト", 5000, 10, 80, None, 0),
                ("G4", "食品", "D", "送別 お菓子", "個包装", 3000, 0, 200, 5.0, 8),
                ("G5", "食品", "E", "チョコ", "ギフト", 4000, 10, 70, 4.0, 2),
            ],
        )
        self.queries = []

        def fetch_all(query, params=()):
            self.queries.append((query, params))
            return [dict(row) for row in self.db.execute(query.replace("%s", "?"), params)]

        database = types.ModuleType("database")
        database.fetch_all = fetch_all
        dotenv = types.ModuleType("dotenv")
        dotenv.load_dotenv = Mock()
        router_modules = {}
        for name in ("reviews", "products", "votes"):
            router_module = types.ModuleType(name)
            router_module.router = APIRouter()
            router_modules[name] = router_module
        module = types.ModuleType("search_under_test")
        source_path = Path(__file__).resolve().parents[1] / "main.py"
        # 検索以外のルーターとDB接続を隔離し、dotenvの呼び出しもスタブ化する。
        # patchの終了時にsys.modulesは元に戻るため、他のテストには影響しない。
        with patch.dict("sys.modules", {"database": database, "dotenv": dotenv, **router_modules}):
            exec(compile(source_path.read_text(encoding="utf-8"), str(source_path), "exec"), module.__dict__)
        self.client = TestClient(module.app)
        self.module = module
        self.addCleanup(self.client.close)

    def search(self, params=None):
        self.queries.clear()
        response = self.client.get("/api/search", params=params)
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        count_sql, count_params = self.queries[0]
        rows_sql, rows_params = self.queries[1]
        self.assertEqual(count_sql.split(" WHERE ")[1], rows_sql.split(" WHERE ")[1].split("\n")[0])
        self.assertEqual(count_params, rows_params[:-1])
        return data

    def ids(self, data):
        return [row["id"] for row in data["results"]]

    def test_no_category_excludes_out_of_stock(self):
        data = self.search()
        self.assertEqual(data["total"], 4)
        self.assertEqual(self.ids(data), ["G1", "G2", "G3", "G5"])
        self.assertNotIn("category =", self.queries[0][0])
        self.assertNotIn("category IN", self.queries[0][0])

    def test_single_new_category(self):
        data = self.search({"categories": "食品"})
        self.assertEqual(data["total"], 2)
        self.assertEqual(self.ids(data), ["G1", "G5"])

    def test_repeated_categories_are_or(self):
        data = self.search([("categories", "食品"), ("categories", "飲料")])
        self.assertEqual(data["total"], 3)
        self.assertEqual(self.ids(data), ["G1", "G2", "G5"])
        self.assertIn("category IN (%s, %s)", self.queries[0][0])

    def test_legacy_category(self):
        self.assertEqual(self.ids(self.search({"category": "飲料"})), ["G2"])

    def test_categories_take_priority(self):
        data = self.search([("category", "コスメ"), ("categories", "食品"), ("categories", "飲料")])
        self.assertEqual(self.ids(data), ["G1", "G2", "G5"])

    def test_keyword_and_categories(self):
        data = self.search([("q", "送別 お菓子"), ("categories", "食品"), ("categories", "飲料")])
        self.assertEqual(data["total"], 1)
        self.assertEqual(self.ids(data), ["G1"])

    def test_price_and_categories(self):
        data = self.search([("categories", "食品"), ("categories", "飲料"), ("price_min", 3000), ("price_max", 4000)])
        self.assertEqual(data["total"], 2)
        self.assertEqual(self.ids(data), ["G2", "G5"])

    def test_business_wrap_and_price(self):
        data = self.search({"indiv_wrap": "true", "price_min": 3000, "price_max": 4999})
        self.assertEqual(data["total"], 1)
        self.assertEqual(self.ids(data), ["G2"])

    def test_total_is_not_limited(self):
        data = self.search([("categories", "食品"), ("categories", "飲料"), ("limit", 1)])
        self.assertEqual(data["total"], 3)
        self.assertEqual(self.ids(data), ["G1"])

    def test_empty_category_is_ignored(self):
        self.assertEqual(self.search({"categories": ""})["total"], 4)

    def test_duplicate_category_does_not_duplicate_rows(self):
        data = self.search([("categories", "食品"), ("categories", "食品")])
        self.assertEqual(data["total"], 2)
        self.assertEqual(self.ids(data), ["G1", "G5"])

    def test_category_is_bound_as_data(self):
        value = "食品') OR 1=1 --"
        data = self.search({"categories": value})
        self.assertEqual(data["total"], 0)
        self.assertNotIn(value, self.queries[0][0])
        self.assertEqual(self.queries[0][1], (value,))


class SearchSortTests(unittest.TestCase):
    """既存12件とは別に、実際の生成SQLをインメモリDBで検証する。"""

    ids = SearchApiTests.ids

    def setUp(self):
        SearchApiTests.setUp(self)
        self.db.executescript("""
            CREATE TABLE orders (order_id TEXT PRIMARY KEY, ordered_at TEXT);
            CREATE TABLE order_items (order_id TEXT, product_id TEXT, quantity INTEGER);
            CREATE TABLE reviews (product_id TEXT, rating REAL);
        """)
        sales = [
            ("2024-07-01 00:00:00", "G1", 2000),
            ("2025-12-31 23:59:59", "G2", 20),
            ("2026-01-01 00:00:00", "G3", 300),
            ("2026-05-31 23:59:59", "G1", 40),
            ("2026-06-01 00:00:00", "G2", 50),
            ("2026-06-23 23:59:59", "G3", 60),
            ("2026-06-24 00:00:00", "G1", 70),
            ("2026-06-30 23:59:59", "G2", 80),
            ("2026-07-01 00:00:00", "G3", 999),
        ]
        for index, (ordered_at, product_id, quantity) in enumerate(sales):
            self.db.execute("INSERT INTO orders VALUES (?, ?)", (str(index), ordered_at))
            self.db.execute("INSERT INTO order_items VALUES (?, ?, ?)", (str(index), product_id, quantity))

    def request(self, sort, period="monthly", **conditions):
        self.queries.clear()
        response = self.client.get("/api/search", params={
            "sort": sort, "popularity_period": period, **conditions,
        })
        self.assertEqual(response.status_code, 200, response.text)
        data = response.json()
        # ランキング用JOINは絞り込み件数に影響しない。
        self.assertEqual(data["total"], self.db.execute(
            self.queries[0][0].replace("%s", "?"), self.queries[0][1]
        ).fetchone()["n"])
        return data

    def test_price_sort_and_id_tie(self):
        self.db.execute("UPDATE products SET price = 3000 WHERE product_id = 'G5'")
        self.assertEqual(self.ids(self.request("price_asc")), ["G1", "G2", "G5", "G3"])

    def test_price_sort_uses_bayesian_score_for_equal_prices(self):
        self.rating_fixture()
        self.db.execute("UPDATE products SET price = 3000")
        data = self.request("price_asc")
        self.assertEqual(self.ids(data), ["G2", "G1", "G3", "G5"])
        self.assertEqual(self.ids(data), self.ids(self.request("rating")))
        self.assertEqual(data["total"], 4)

    def test_price_is_always_more_important_than_rating(self):
        self.rating_fixture()
        self.db.execute("UPDATE products SET price = 500 WHERE product_id = 'G5'")
        self.assertEqual(self.ids(self.request("price_asc")), ["G5", "G1", "G2", "G3"])

    def test_price_ties_use_review_count_then_product_id(self):
        self.db.execute("UPDATE products SET price = 3000")
        self.db.executemany("INSERT INTO reviews VALUES (?, ?)",
            [("G1", 4)] + [("G2", 4)] * 2 + [("G3", 4)] * 2)
        self.assertEqual(self.ids(self.request("price_asc")), ["G2", "G3", "G1", "G5"])

    def test_equal_price_unrated_products_follow_reviewed_products(self):
        self.db.execute("UPDATE products SET price = 3000")
        self.db.executemany("INSERT INTO reviews VALUES (?, ?)",
            [("G5", 1), ("G1", None), ("G2", 0), ("G3", 6)])
        self.assertEqual(self.ids(self.request("price_asc")), ["G5", "G1", "G2", "G3"])

    def test_price_rating_aggregate_runs_once_and_only_when_needed(self):
        self.request("price_asc")
        self.assertEqual(len(self.queries), 2)
        self.assertEqual(self.queries[1][0].count("WITH valid_reviews AS"), 1)
        self.assertEqual(self.queries[1][0].count("FROM reviews r"), 1)
        self.request("popular")
        self.assertNotIn("review_stats", self.queries[1][0])

    def test_weekly_includes_june_30_excludes_july_1(self):
        data = self.request("popular", "weekly")
        self.assertEqual(self.ids(data), ["G2", "G1", "G3", "G5"])
        self.assertEqual(self.queries[1][1][:2], ("2026-06-24", "2026-07-01"))

    def test_monthly_is_calendar_month(self):
        self.assertEqual(self.ids(self.request("popular")), ["G2", "G1", "G3", "G5"])
        self.assertEqual(self.queries[1][1][:2], ("2026-06-01", "2026-07-01"))

    def test_yearly_is_calendar_year(self):
        self.assertEqual(self.ids(self.request("popular", "yearly")), ["G3", "G2", "G1", "G5"])
        self.assertEqual(self.queries[1][1][:2], ("2026-01-01", "2026-07-01"))

    def test_all_has_no_date_restriction(self):
        self.assertEqual(self.ids(self.request("popular", "all")), ["G1", "G3", "G2", "G5"])
        self.assertNotIn("ordered_at", self.queries[1][0])

    def test_popular_defaults_to_monthly(self):
        response = self.client.get("/api/search", params={"sort": "popular"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.ids(response.json()), ["G2", "G1", "G3", "G5"])

    def test_quantity_not_number_of_orders_and_multiple_lines(self):
        for index in range(5):
            self.db.execute("INSERT INTO orders VALUES (?, ?)", (f"extra{index}", "2026-06-30 12:00:00"))
            self.db.execute("INSERT INTO order_items VALUES (?, ?, ?)", (f"extra{index}", "G5", 1))
        self.db.execute("INSERT INTO order_items VALUES ('7', 'G1', 20)")
        data = self.request("popular", "weekly")
        self.assertEqual(self.ids(data), ["G1", "G2", "G5", "G3"])
        self.assertEqual(data["total"], 4)

    def test_no_sales_still_returns_products_by_id(self):
        self.db.execute("DELETE FROM order_items")
        self.assertEqual(self.ids(self.request("popular")), ["G1", "G2", "G3", "G5"])

    def test_positive_sales_tie_uses_product_id(self):
        self.db.execute("INSERT INTO order_items VALUES ('7', 'G1', 10)")
        self.assertEqual(self.ids(self.request("popular", "weekly")), ["G1", "G2", "G3", "G5"])

    def test_demo_reference_date_is_configurable(self):
        from datetime import date
        with patch.object(self.module, "DEMO_REFERENCE_DATE", date(2026, 7, 1)):
            self.request("popular", "weekly")
        self.assertEqual(self.queries[1][1][:2], ("2026-06-25", "2026-07-02"))

    def rating_fixture(self):
        self.db.executemany("INSERT INTO reviews VALUES (?, ?)",
            [("G1", 5)] + [("G2", 5)] * 12 + [("G2", 4)] * 8 + [("G3", 1)]
            + [("G5", None), ("G5", 0), ("G5", 6), ("missing-product", 1)])

    def test_bayesian_rating_corrects_small_samples_and_keeps_display(self):
        self.rating_fixture()
        data = self.request("rating")
        self.assertEqual(self.ids(data), ["G2", "G1", "G3", "G5"])
        self.assertEqual(data["results"][0]["rating"], 4.0)
        self.assertEqual(data["results"][0]["reviewCount"], 3)

    def test_bayesian_score_uses_all_existing_products_reviews(self):
        self.rating_fixture()
        self.request("rating")
        sql, params = self.queries[1]
        score = sql[sql.index("(1.0 * review_stats.rating_sum"):].split(" DESC,", 1)[0]
        scored_sql = sql.replace("p.price, p.rating, p.review_count", f"p.price, p.rating, p.review_count, {score} AS score")
        rows = self.db.execute(scored_sql.replace("%s", "?"), (10, 10, *params)).fetchall()
        values = {row["product_id"]: row["score"] for row in rows}
        c = 98 / 22
        self.assertAlmostEqual(values["G1"], (5 + 10 * c) / 11)
        self.assertAlmostEqual(values["G2"], (92 + 10 * c) / 30)
        self.assertIsNone(values["G5"])
        self.assertEqual(self.module.BAYES_PRIOR_WEIGHT, 10)

    def test_rating_ties_use_count_then_id(self):
        self.db.executemany("INSERT INTO reviews VALUES (?, ?)",
            [("G1", 4)] + [("G2", 4)] * 2 + [("G3", 4)] * 2)
        self.assertEqual(self.ids(self.request("rating")), ["G2", "G3", "G1", "G5"])

    def test_global_average_does_not_depend_on_search_or_stock(self):
        self.rating_fixture()
        self.db.execute("INSERT INTO reviews VALUES ('G4', 5)")
        data = self.request("rating", category="食品")
        self.assertEqual(self.ids(data), ["G1", "G5"])
        # 全商品・在庫切れを含む母集団からCを計算し、絞り込みでCを変えない。
        sql, params = self.queries[1]
        score = sql[sql.index("(1.0 * review_stats.rating_sum"):].split(" DESC,", 1)[0]
        scored_sql = sql.replace("p.price, p.rating, p.review_count", f"p.price, p.rating, p.review_count, {score} AS score")
        rows = self.db.execute(scored_sql.replace("%s", "?"), (10, 10, *params)).fetchall()
        self.assertAlmostEqual(rows[0]["score"], (5 + 10 * (103 / 23)) / 11)

    def test_no_valid_reviews_returns_id_order(self):
        self.db.executemany("INSERT INTO reviews VALUES (?, ?)", [("G1", None), ("G2", 0), ("G3", 6)])
        self.assertEqual(self.ids(self.request("rating")), ["G1", "G2", "G3", "G5"])

    def test_sort_filters_total_and_limit(self):
        self.rating_fixture()
        for sort in ("price_asc", "popular", "rating"):
            with self.subTest(sort=sort):
                data = self.request(sort, categories=["食品", "飲料"], q="送別", price_min=1500, price_max=3000, limit=1)
                self.assertEqual(data["total"], 2)
                self.assertEqual(len(data["results"]), 1)
                self.assertIn(data["results"][0]["id"], ["G1", "G2"])

    def test_invalid_sort_and_period_are_rejected_before_db(self):
        for params in ({"sort": "unknown"}, {"sort": "price ASC; DROP TABLE products"},
                       {"sort": "popular", "popularity_period": "unknown"}):
            with self.subTest(params=params):
                self.queries.clear()
                self.assertEqual(self.client.get("/api/search", params=params).status_code, 422)
                self.assertEqual(self.queries, [])


if __name__ == "__main__":
    unittest.main()
