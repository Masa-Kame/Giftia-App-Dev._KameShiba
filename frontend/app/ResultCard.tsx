import Link from "next/link";
import type { Gift } from "../lib/api.ts";

export default function ResultCard({ gift, rank}: { gift: Gift; rank: number}) {
    return (
        <Link className="card result-card-link" href={`/products/${encodeURIComponent(gift.id)}`} aria-label={`${gift.name}の商品詳細を見る`}>
            <p className="meta">{rank}位・{gift.category}・{gift.brand}</p>
            <h3 className="name">{gift.name}</h3>
            <p className="price">{gift.price.toLocaleString()}円</p>
            <p className="meta">評価{gift.rating} ({gift.reviewCount}件）</p>
            {gift.recommendation && <section className="recommendation-reasons" aria-label="おすすめ理由">
                <p className="meta">{gift.recommendation.group === "match" ? "ポリシー一致" : gift.recommendation.group === "untagged" ? "ポリシー未付与" : "反対ポリシー"}</p>
                <h4>おすすめ理由</h4>
                <ul>{gift.recommendation.reasons.slice(0, 3).map((reason, i) => <li key={i}>
                    <span className="reason-source">{reason.source === "demo_curated" ? "デモ属性" : "DBデータ"}</span> {reason.text}
                </li>)}</ul>
            </section>}
        </Link>
    );
}
