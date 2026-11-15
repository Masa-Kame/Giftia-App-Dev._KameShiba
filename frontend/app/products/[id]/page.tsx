export default function ProductDetailPage() {
  const reviews = [
    {
      scene: "送別",
      comment: "職場の送別品として渡したところ喜ばれました。",
      helpful: 12,
    },
    {
      scene: "出産祝い",
      comment: "見た目が可愛く、お祝いにぴったりでした。",
      helpful: 8,
    },
  ];

  return (
    <main style={{ maxWidth: "800px", margin: "0 auto", padding: "24px" }}>
      <h1>コーヒーギフトセット</h1>

      <div
        style={{
          height: "250px",
          background: "#f3f3f3",
          borderRadius: "8px",
          marginBottom: "16px",
        }}
      >
        商品画像
      </div>

      <p>価格: ¥4,500</p>

      <p>
        コーヒー好きな方へのギフトとして人気の商品です。
      </p>

      <hr style={{ margin: "24px 0" }} />

      <h2>利用シーン別口コミ</h2>

      <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
        <button>送別</button>
        <button>出産祝い</button>
        <button>お中元</button>
        <button>お歳暮</button>
      </div>

      {reviews.map((review, index) => (
        <div
          key={index}
          style={{
            border: "1px solid #ddd",
            padding: "12px",
            marginBottom: "12px",
            borderRadius: "8px",
          }}
        >
          <p>
            <strong>{review.scene}</strong>
          </p>

          <p>{review.comment}</p>

          <div>
            👍 {review.helpful}
            <button style={{ marginLeft: "12px" }}>
              参考になった
            </button>
            <button style={{ marginLeft: "8px" }}>
              参考にならなかった
            </button>
          </div>
        </div>
      ))}

      <hr style={{ margin: "24px 0" }} />

      <h2>口コミ投稿</h2>

      <select>
        <option>送別</option>
        <option>誕生日</option>
        <option>父の日</option>
        <option>母の日</option>
        <option>結婚祝い</option>
        <option>出産祝い</option>
        <option>お中元</option>
        <option>お歳暮</option>
        <option>お礼</option>


      </select>

      <br />
      <br />

      <textarea
        rows={4}
        placeholder="口コミを入力"
        style={{ width: "100%" }}
      />

      <br />
      <br />

      <button>投稿する</button>
    </main>
  );
}
