"""Export STEP B evidence with SELECT only; never print connection details.

Run from backend: python -B -X utf8 scripts/export_step_b.py
"""

import csv
import json
import os
import sys
from collections import Counter
from contextlib import contextmanager
from datetime import datetime
from decimal import Decimal
from pathlib import Path
from time import perf_counter

BACKEND_DIR = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_DIR))

PRODUCT_SQL = """
WITH valid_reviews AS (
    SELECT r.product_id, r.rating
    FROM reviews r JOIN products p ON p.product_id = r.product_id
    WHERE r.rating BETWEEN 1 AND 5
), review_stats AS (
    SELECT product_id, COUNT(*) AS valid_review_count, SUM(rating) AS rating_sum
    FROM valid_reviews GROUP BY product_id
), global_rating AS (
    SELECT AVG(rating) AS average_c FROM valid_reviews
)
SELECT p.product_id, p.product_name, p.category, p.price, p.stock, p.description,
       COALESCE(rs.valid_review_count, 0) AS valid_review_count,
       COALESCE(rs.rating_sum, 0) AS rating_sum, g.average_c
FROM products p
LEFT JOIN review_stats rs ON rs.product_id = p.product_id
CROSS JOIN global_rating g
WHERE EXISTS (
    SELECT 1 FROM product_scenes ps
    WHERE ps.product_id = p.product_id AND ps.scene_tag = %s
)
ORDER BY p.product_id
"""

PURCHASE_SQL = """
SELECT oi.product_id, SUM(oi.quantity) AS purchased_quantity
FROM orders o
JOIN order_items oi ON oi.order_id = o.order_id
JOIN products p ON p.product_id = oi.product_id
WHERE o.gift_purpose = %s AND o.ordered_at < %s
GROUP BY oi.product_id
ORDER BY oi.product_id
"""

PRODUCT_COLUMNS = [
    "product_id", "product_name", "category", "price", "stock", "description",
    "valid_review_count", "rating_sum", "average_c",
]
PURCHASE_COLUMNS = ["product_id", "purchased_quantity"]


class ExportError(Exception):
    """Only fixed, non-sensitive messages may be used here."""


@contextmanager
def log_stage(name):
    """Log fixed stage names and safe diagnostics, never exception messages."""
    started = perf_counter()
    print(f"[START] {name}", flush=True)
    try:
        yield
    except Exception as exc:
        code = exc.args[0] if exc.args and isinstance(exc.args[0], int) else None
        print(
            f"[FAIL] {name} elapsed={perf_counter() - started:.3f}s "
            f"error_type={type(exc).__name__} error_code={code}",
            flush=True,
        )
        raise
    else:
        print(f"[OK] {name} elapsed={perf_counter() - started:.3f}s", flush=True)


def missing(value):
    return value is None or str(value).strip().lower() in ("", "undefined", "null")


def id_checks(rows):
    counts = Counter(row["product_id"] for row in rows if not missing(row["product_id"]))
    return {
        "missing_ids": sum(missing(row["product_id"]) for row in rows),
        "duplicate_ids": sum(count > 1 for count in counts.values()),
    }


def write_csv(path, columns, rows):
    with path.open("x", encoding="utf-8-sig", newline="") as file:
        writer = csv.DictWriter(file, fieldnames=columns, extrasaction="raise", quoting=csv.QUOTE_ALL)
        writer.writeheader()
        writer.writerows(rows)
    # Round-trip through the CSV parser, including embedded commas/newlines/quotes.
    with path.open("r", encoding="utf-8-sig", newline="") as file:
        reader = csv.DictReader(file)
        if reader.fieldnames != columns:
            raise ExportError("CSVヘッダーの検証に失敗しました。")
        restored = list(reader)
    expected = [{key: "" if row[key] is None else str(row[key]) for key in columns} for row in rows]
    if restored != expected or not path.read_bytes().startswith(b"\xef\xbb\xbf"):
        raise ExportError("CSVのBOM・再読込検証に失敗しました。")


def integer_quantity(value):
    """Keep NULL visible in the report; reject truncation and non-finite values."""
    if value is None:
        return None
    if isinstance(value, bool) or not isinstance(value, (int, Decimal)):
        raise ExportError("購入数量に整数として扱えない値があります。")
    if isinstance(value, Decimal) and (not value.is_finite() or value != value.to_integral_value()):
        raise ExportError("購入数量に小数または非有限値があります。")
    return int(value)


def build_report(products, purchases, output_dir):
    product_ids = id_checks(products)
    purchase_ids = id_checks(purchases)
    quantities = [integer_quantity(row["purchased_quantity"]) for row in purchases]
    total_quantity = int(sum(value or 0 for value in quantities))
    return {
        "output_directory": str(output_dir),
        "farewell_product_count": len(products),
        "in_stock_product_count": sum(row["stock"] is not None and row["stock"] > 0 for row in products),
        "purchase_product_count": len(purchases),
        "positive_purchase_product_count": sum((value or 0) > 0 for value in quantities),
        "purchased_quantity_total": total_quantity,
        "product_id_checks": product_ids,
        "purchase_id_checks": purchase_ids,
        "missing_product_names": sum(missing(row["product_name"]) for row in products),
        "missing_descriptions": sum(missing(row["description"]) for row in products),
        "missing_purchase_quantities": sum(value is None for value in quantities),
        "nonpositive_purchase_quantities": sum((value or 0) <= 0 for value in quantities),
        "expected_product_count_matches": len(products) == 3746,
        "expected_quantity_total_matches": total_quantity == 26110,
        "csv_bom_and_round_trip": "passed",
    }


def main():
    # database.py loads the existing .env internally. Do not inspect or print it.
    with log_stage("database.pyの読み込み"):
        import database as database_module
        from database import fetch_all

        loaded_path = getattr(database_module, "__file__", None)
        expected_file = (BACKEND_DIR / "database.py").resolve()
        matches = loaded_path is not None and Path(loaded_path).resolve() == expected_file
        print(f"[INFO] database_module_matches_expected={matches}", flush=True)

        required = ("DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME")
        absent = [key for key in required if not os.environ.get(key)]
        if absent:
            raise ExportError("必要な環境変数が不足しています（変数名のみ）: " + ", ".join(absent))

    with log_stage("接続先DBの確認"):
        database = fetch_all("SELECT DATABASE() AS db")
        if not database or database[0]["db"] != "giftia_t105":
            raise ExportError("対象DBが一致しません。CSVは出力しません。")

    with log_stage("送別商品・口コミデータの取得"):
        products = fetch_all(PRODUCT_SQL, ("送別",))
        print(f"[INFO] product_rows={len(products)}", flush=True)

    with log_stage("購入実績データの取得"):
        purchases = fetch_all(PURCHASE_SQL, ("送別", "2026-07-01"))
        print(f"[INFO] purchase_rows={len(purchases)}", flush=True)
    if not products or not purchases:
        raise ExportError("必要なデータが取得できません。CSVは出力しません。")

    with log_stage("CSVファイルの生成・再読込検証"):
        stamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
        output_dir = BACKEND_DIR / "exports" / f"step_b_{stamp}"
        output_dir.mkdir(parents=True, exist_ok=False)
        write_csv(output_dir / "farewell_products.csv", PRODUCT_COLUMNS, products)
        write_csv(output_dir / "farewell_purchases.csv", PURCHASE_COLUMNS, purchases)

    try:
        with log_stage("整合性集計・結果表示"):
            report = build_report(products, purchases, output_dir)
            print(json.dumps(report, ensure_ascii=False, indent=2), flush=True)
            if (any(report["product_id_checks"].values()) or any(report["purchase_id_checks"].values())
                    or not report["expected_product_count_matches"]
                    or not report["expected_quantity_total_matches"]
                    or report["missing_purchase_quantities"] or report["nonpositive_purchase_quantities"]):
                raise ExportError("整合性に相違があります。ランキング検証を開始せず、集計結果を確認してください。")
    except ExportError as exc:
        raise ExportError("CSV生成・再読込検証は完了していますが、整合性集計・確認に問題があります。 "
                          + str(exc)) from None
    except Exception:
        raise ExportError("CSV生成・再読込検証は完了していますが、整合性集計・結果表示に失敗しました。"
                          "CSV出力失敗ではありません。保存済みCSVは変更せず、表示処理を確認してください。") from None


if __name__ == "__main__":
    try:
        main()
    except ExportError as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(2)
    except Exception as exc:
        # No traceback: DB drivers may include connection details in exceptions.
        print("データ取得またはCSV生成・再読込検証に失敗しました。段階ログを確認してください。"
              "作成途中のCSVは検証に使わないでください。", file=sys.stderr)
        # Exception type and integer error code only, never the driver message.
        code = exc.args[0] if exc.args and isinstance(exc.args[0], int) else None
        print(f"error_type={type(exc).__name__}, error_code={code}", file=sys.stderr)
        sys.exit(1)
