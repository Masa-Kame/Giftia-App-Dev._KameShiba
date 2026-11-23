import Link from "next/link";
import type { Gift } from "../lib/api.ts";

export default function ResultCard({ gift, rank}: { gift: Gift; rank: number}) {
    // 保存済みの旧レスポンスに含まれるシーン・口コミ理由も表示しない。
    const reasons = ["feature", "purchase"].flatMap((kind) => {
        const reason = gift.recommendation?.reasons.find((item) => item.kind === kind && item.text);
        return reason ? [reason] : [];
    });
    return (
        <Link className="card result-card-link" href={`/products/${encodeURIComponent(gift.id)}`} aria-label={`${gift.name}の商品詳細を見る`}>
            <p className="meta">{rank}位・{gift.category}・{gift.brand}</p>
            <h3 className="name">{gift.name}</h3>
            <p className="price">{gift.price.toLocaleString()}円</p>
            <p className="meta">評価{gift.rating} ({gift.reviewCount}件）</p>
            {reasons.length > 0 && <section className="recommendation-reasons" aria-label="おすすめ理由">
                <h4>おすすめ理由</h4>
                <ul>{reasons.map((reason) => <li key={reason.kind}>
                    <span className="reason-source">{reason.kind === "feature" ? "商品の特徴" : "購入実績"}</span> {reason.text}
                </li>)}</ul>
            </section>}
        </Link>
    );
}
