// おすすめ検索のポリシー状態と必須入力判定。送別のみの対応制御は画面側で行う。
export type GiftPolicy = "" | "classic" | "unique";

export function needsGiftPolicy(scene: string): boolean {
  return scene === "送別" || scene === "取引先へのお礼";
}

export function recommendationRequirement(mode: string, scene: string, policy: GiftPolicy): string {
  if (mode !== "recommended") return "";
  if (!scene) return "おまかせで探すには、シーンを選択してください。";
  if (needsGiftPolicy(scene) && !policy) {
    return "ギフトポリシーを選択してください。";
  }
  return "";
}
