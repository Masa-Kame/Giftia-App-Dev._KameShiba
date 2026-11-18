import Link from "next/link";
import type { Gift } from "../lib/api.ts";

export default function ResultCard({ gift, rank}: { gift: Gift; rank: number}) {
    return (
        <Link className="card result-card-link" href={`/products/${encodeURIComponent(gift.id)}`} aria-label={`${gift.name}の商品詳細を見る`}>
            <p className="meta">{rank}位・{gift.category}・{gift.brand}</p>
            <h3 className="name">{gift.name}</h3>
            <p className="price">{gift.price.toLocaleString()}円</p>
            <p className="meta">評価{gift.rating} ({gift.reviewCount}件）</p>
        </Link>
    );
}
