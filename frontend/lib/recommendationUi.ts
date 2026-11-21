// STEP AのUI専用。ランキングAPIのパラメーターにはまだ追加しない。
export type GiftPolicy = "" | "classic" | "unique";

export function needsGiftPolicy(scene: string): boolean {
  return scene === "送別" || scene === "取引先へのお礼";
}

export function recommendationRequirement(mode: string, scene: string, policy: GiftPolicy): string {
  if (mode !== "recommended") return "";
  if (!scene) return "おすすめ検索には、シーンを選択してください。";
  if (needsGiftPolicy(scene) && !policy) {
    return "おすすめ検索には、ギフトポリシー（王道・ユニーク）を選択してください。";
  }
  return "";
}
