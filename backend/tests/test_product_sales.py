"""商品詳細の直近1年購入数量。実MySQL・環境変数を使わずSQLを実行する。"""

import sqlite3
import unittest
from contextlib import contextmanager
from datetime import date
from unittest.mock import patch

from fastapi.testclient import TestClient
from fastapi import FastAPI

import test_similar_products as fixture


class ProductSalesTests(unittest.TestCase):
    def setUp(self):
        self.products = fixture.load_products_module()
        self.db = sqlite3.connect(":memory:", check_same_thread=False)
        self.addCleanup(self.db.close)
        self.db.row_factory = sqlite3.Row
        self.db.executescript("""
            CREATE TABLE products (product_id TEXT, sales_count INTEGER);
            INSERT INTO products VALUES ('G1', 9999), ('G2', 5);
            CREATE TABLE product_scenes (product_id TEXT, scene_tag TEXT);
            CREATE TABLE product_targets (product_id TEXT, target_age TEXT, target_gender TEXT);
            CREATE TABLE product_preference (product_id TEXT, preference_tag_id TEXT);
            CREATE TABLE preference_tags (preference_tag_id TEXT, preference_category TEXT, preference_tag TEXT);
            CREATE TABLE orders (order_id TEXT, ordered_at TEXT);
            CREATE TABLE order_items (order_id TEXT, product_id TEXT, quantity INTEGER);
        """)
        self.queries = []
        self.connections = 0
        owner = self

        class Cursor(fixture.SqliteCursor):
            def execute(self, query, params=()):
                owner.queries.append((query, params))
                super().execute(query, params)

            def fetchone(self):
                row = self.cur.fetchone()
                return dict(row) if row else None

        @contextmanager
        def cursor():
            self.connections += 1
            yield Cursor(self.db)

        self.products.db_cursor = cursor
        app = FastAPI()
        app.include_router(self.products.router)
        self.client = TestClient(app)
        self.addCleanup(self.client.close)

    def add_order(self, order_id, ordered_at, quantity, product_id="G1"):
        self.db.execute("INSERT INTO orders VALUES (?, ?)", (order_id, ordered_at))
        self.db.execute("INSERT INTO order_items VALUES (?, ?, ?)", (order_id, product_id, quantity))

    def test_boundaries_quantity_not_order_count_and_legacy_value(self):
        for args in [
            ("before", "2025-06-30 23:59:59", 100),
            ("start", "2025-07-01 00:00:00", 2),
            ("end", "2026-06-30 23:59:59", 5),
            ("after", "2026-07-01 00:00:00", 200),
            ("other", "2026-06-30 12:00:00", 50, "G2"),
        ]:
            self.add_order(*args)
        response = self.client.get("/api/products/G1")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["recent_year_sales_count"], 7)
        self.assertEqual(data["sales_count"], 9999)
        self.assertEqual(data["sales_period_start"], "2025-07-01")
        self.assertEqual(data["sales_period_end"], "2026-06-30")
        self.assertEqual(self.connections, 1)
        self.assertEqual(self.queries[1][1], ("G1", "2025-07-01", "2026-07-01"))

    def test_no_orders_returns_zero_not_stored_count(self):
        data = self.client.get("/api/products/G2").json()
        self.assertEqual(data["recent_year_sales_count"], 0)
        self.assertEqual(data["sales_count"], 5)

    def test_missing_product_skips_aggregation(self):
        self.assertEqual(self.client.get("/api/products/missing").status_code, 404)
        self.assertEqual(len(self.queries), 1)

    def test_product_id_is_bound_as_data(self):
        value = "G1' OR 1=1 --"
        self.assertEqual(self.client.get("/api/products/" + value).status_code, 404)
        self.assertNotIn(value, self.queries[0][0])
        self.assertEqual(self.queries[0][1], (value,))

    def test_leap_day_and_configured_reference(self):
        self.assertEqual(self.products._recent_year_bounds(date(2024, 2, 29)),
                         (date(2023, 3, 1), date(2024, 3, 1)))
        self.assertEqual(self.products._recent_year_bounds(date(2024, 2, 28)),
                         (date(2023, 2, 28), date(2024, 2, 29)))
        with patch.object(self.products, "DEMO_REFERENCE_DATE", date(2027, 1, 31)):
            data = self.client.get("/api/products/G1").json()
        self.assertEqual(data["sales_period_start"], "2026-02-01")
        self.assertEqual(data["sales_period_end"], "2027-01-31")
