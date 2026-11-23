"""似た商品（商品詳細の「この商品を探している方へのおすすめ」）の並び順と理由を確認する。

実行: python -B -m unittest discover -s backend/tests -v
SQLをSQLiteのインメモリDBで実行し、MySQLとの実接続は行わない。
"""

import importlib.util
import sqlite3
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch


def load_products_module():
    """database（DB接続）を差し替えて products.py を読み込む"""
    database = types.ModuleType("database")
    database.db_cursor = None  # このテストでは使わない（find_similar_products にカーソルを直接渡す）
    path = Path(__file__).resolve().parents[1] / "products.py"
    spec = importlib.util.spec_from_file_location("products_under_test", path)
    module = importlib.util.module_from_spec(spec)
    # 読み込みの間だけ差し替える（ほかのテストに影響させない）
    with patch.dict(sys.modules, {"database": database}):
        spec.loader.exec_module(module)
    return module


class SqliteCursor:
    """MySQL の %s を SQLite の ? に置き換えて実行するカーソル"""

    def __init__(self, db):
        self.cur = db.cursor()

    def execute(self, query, params=()):
        self.cur.execute(query.replace("%s", "?"), params)

    def fetchall(self):
        return [dict(row) for row in self.cur.fetchall()]


class SimilarProductsTests(unittest.TestCase):
    def setUp(self):
        self.products = load_products_module()
        self.db = sqlite3.connect(":memory:")
        self.addCleanup(self.db.close)
        self.db.row_factory = sqlite3.Row
        self.db.executescript("""
            CREATE TABLE products (product_id TEXT, product_name TEXT, brand TEXT, category TEXT,
                price INTEGER, stock INTEGER, rating REAL, review_count INTEGER);
            CREATE TABLE product_scenes (product_id TEXT, scene_tag TEXT);
            CREATE TABLE reviews (product_id TEXT, rating REAL);
            INSERT INTO products VALUES
              ('T',    '対象',             'A', '食品', 4000, 5, 4.0, 1),
              ('S2',   '2シーン共通',       'B', '飲料', 4200, 5, NULL, 0),
              ('S1C',  '1シーン＋同カテゴリ', 'C', '食品', 3800, 5, 3.0, 1),
              ('S1CH', '1シーン＋同カテゴリ・高評価', 'D', '食品', 3000, 5, 5.0, 5),
              ('S1',   '1シーンのみ',       'E', 'コスメ', 4000, 5, NULL, 0),
              ('C',    '同カテゴリのみ',     'F', '食品', 4100, 5, NULL, 0),
              ('OUT',  '在庫なし',          'G', '食品', 4000, 0, NULL, 0),
              ('HIGH', '価格が1.5倍超',     'H', '食品', 6100, 5, NULL, 0),
              ('NONE', '関係なし',          'I', '家電', 4000, 5, NULL, 0);
            INSERT INTO product_scenes VALUES
              ('T', '送別'), ('T', 'お礼'),
              ('S2', '送別'), ('S2', 'お礼'), ('S2', 'お礼'),
              ('S1C', '送別'), ('S1CH', 'お礼'), ('S1', 'お礼'),
              ('OUT', '送別'), ('HIGH', '送別');
            INSERT INTO reviews VALUES
              ('S1CH', 5), ('S1CH', 5), ('S1CH', 5), ('S1CH', 5), ('S1CH', 5),
              ('S1C', 3), ('T', 4), ('S2', 0);
        """)

    def similar(self, product_id="T", limit=10):
        return self.products.find_similar_products(SqliteCursor(self.db), product_id, limit)

    def test_order_by_shared_scenes_category_rating_price(self):
        ids = [item["product_id"] for item in self.similar()]
        # 共通シーン2つ → 1つ＋同カテゴリ（補正評価の高い順）→ 1つ → 同カテゴリのみ
        self.assertEqual(ids, ["S2", "S1CH", "S1C", "S1", "C"])

    def test_excludes_self_out_of_stock_price_range_and_unrelated(self):
        ids = {item["product_id"] for item in self.similar()}
        self.assertTrue(ids.isdisjoint({"T", "OUT", "HIGH", "NONE"}))

    def test_reasons_are_built_from_data(self):
        items = {item["product_id"]: item for item in self.similar()}
        self.assertEqual(items["S2"]["reasons"], ["同じシーン（お礼・送別）で選ばれている", "近い価格帯"])
        self.assertEqual(items["C"]["reasons"], ["同じカテゴリ（食品）", "近い価格帯"])

    def test_display_rating_is_same_as_product_detail(self):
        items = {item["product_id"]: item for item in self.similar()}
        self.assertEqual((items["S1CH"]["rating"], items["S1CH"]["review_count"]), (5.0, 5))
        self.assertIsNone(items["S2"]["rating"])

    def test_limit(self):
        self.assertEqual(len(self.similar(limit=2)), 2)


if __name__ == "__main__":
    unittest.main()
