// STEP AのUI専用。ランキングAPIのパラメーターにはまだ追加しない。
export type GiftPolicy = "" | "classic" | "unique";

export function needsGiftPolicy(scene: string): boolean {
  return scene === "送別" || scene === "取引先へのお礼";
}

export function recommendationRequirement(sort: string, scene: string, policy: GiftPolicy): string {
  if (sort !== "recommended") return "";
  if (!scene) return "おすすめ順で検索するには、シーンを選択してください。";
  if (needsGiftPolicy(scene) && !policy) {
    return "おすすめ順で検索するには、ギフトポリシー（王道・ユニーク）を選択してください。";
  }
  return "";
}
