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


if __name__ == "__main__":
    unittest.main()
