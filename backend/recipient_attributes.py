"""受取人向けのデモ属性。DB移行時は読み込み部分を差し替える。"""

import json
from pathlib import Path
from typing import Literal

TargetAge = Literal["", "指定なし", "20代", "30代", "40代", "50代", "60代以上"]
TargetGender = Literal["", "指定なし", "男性", "女性"]
PreferenceId = Literal[
    "travel", "gourmet", "beauty", "gadgets", "plants-flowers", "simple",
    "alcohol", "coffee-tea", "fashion", "interior", "cooking", "relaxation",
    "outdoors", "health", "stationery", "other",
]
ATTRIBUTES_PATH = Path(__file__).resolve().parent / "data" / "demo_recipient_attributes.json"


def load_recipient_products():
    return json.loads(ATTRIBUTES_PATH.read_text(encoding="utf-8"))["products"]


def matching_recipient_product_ids(target_age="", target_gender="", preferences=()):
    """未指定はNone。指定ありで一致なしは空配列（条件緩和しない）。"""
    age = None if target_age in ("", "指定なし") else target_age
    gender = None if target_gender in ("", "指定なし") else target_gender
    selected_preferences = set(preferences)
    if not age and not gender and not selected_preferences:
        return None
    matches = []
    for product_id, attributes in load_recipient_products().items():
        # 年代と性別を別々の集合にせず、実在する同一ペアで照合する。
        if (age or gender) and not any(
            (not age or target["target_age"] == age)
            and (not gender or target["target_gender"] == gender)
            for target in attributes["targets"]
        ):
            continue
        if selected_preferences and not selected_preferences.intersection(attributes["preferences"]):
            continue
        matches.append(product_id)
    return sorted(matches)
