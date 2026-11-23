import styles from "./product.module.css";
import reviewStyles from "./review.module.css";

// 商品情報を読み込んでいる間の仮表示（スケルトン）
// 本物と同じくらいの場所を先に確保して、読み込み後に口コミ欄が押し下げられないようにする
export default function ProductSkeleton() {
  return (
    <div aria-busy="true" aria-label="商品情報を読み込み中">
      <section className={reviewStyles.product}>
        <div className={`${styles.skeleton} ${styles.skeletonImage}`} />
        <div className={styles.skeletonColumn}>
          <div className={`${styles.skeleton} ${styles.skeletonBrand}`} />
          <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
          <div className={`${styles.skeleton} ${styles.skeletonText}`} />
          <div className={`${styles.skeleton} ${styles.skeletonPrice}`} />
          <div className={`${styles.skeleton} ${styles.skeletonBuyBox}`} />
        </div>
      </section>
      <div className={`${styles.skeleton} ${styles.skeletonDetails}`} />
    </div>
  );
}
