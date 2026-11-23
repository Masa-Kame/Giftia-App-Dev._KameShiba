# database.py — 班のDB（Azure Database for MySQL）につなぐ
#
# 接続情報は .env に置く（Workbench に入れたものと同じ5つ）。コードに書かない。GitHub に上げない。
#   DB_HOST     = ホスト名（xxx.mysql.database.azure.com）
#   DB_PORT     = 3306
#   DB_USER     = 配られたユーザー名（例 tech0gen13-class1）
#   DB_PASSWORD = 班のパスワード
#   DB_NAME     = 班のDB名（例 giftia_t101 ＝ クラス1の班1）
#   DB_SSL_CA   = 配布された SSL証明書のパス（任意。入れると Workbench の「Verify CA」と同じく相手を確かめる）

import os
import queue
import time
from contextlib import contextmanager

import pymysql
from dotenv import load_dotenv

load_dotenv()  # 同じフォルダの .env を読み、os.environ に入れる


def get_connection():
    """班のDBへの接続を1つ作って返す。使い終わったら close() する（fetch_all が面倒を見る）"""
    required = ["DB_HOST", "DB_USER", "DB_PASSWORD", "DB_NAME"]
    missing = [k for k in required if not os.environ.get(k)]
    if missing:
        raise EnvironmentError(f".env に設定がありません: {', '.join(missing)}（.env.example を .env にコピーして埋める）")

    # Azure は暗号化（SSL/TLS）しない接続を断る。証明書のパスがあれば、相手が Azure のサーバーかも確かめる
    ssl = {"ca": os.environ["DB_SSL_CA"]} if os.environ.get("DB_SSL_CA") else {"ssl_disabled": False}

    return pymysql.connect(
        host=os.environ["DB_HOST"],
        port=int(os.environ.get("DB_PORT", "3306")),
        user=os.environ["DB_USER"],
        password=os.environ["DB_PASSWORD"],
        database=os.environ["DB_NAME"],
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,  # 行を {列名: 値} の形で受け取る（JSON にしやすい）
        connect_timeout=10,
        ssl=ssl,
        autocommit=True,  # 読み取りは毎回最新を見る（使い回した接続で古いスナップショットを読まない）。書き込みは transaction() で begin する
    )


# ── 接続の使い回し（コネクションプール）─────────────────
# Azure への接続は SSL・認証込みで1回数百ミリ秒かかる。毎回つなぎ直さず、使い終わった接続を取っておいて再利用する。
# FastAPI は同時に複数のリクエストを別スレッドで処理するので、スレッドセーフな Queue で管理する。
POOL_MAX_IDLE = 5  # 取っておく接続の最大数（同時アクセスが多いときは一時的に増え、余った分は閉じる）
POOL_PING_AFTER = 30  # この秒数以上使っていない接続は、使う前に生きているか確かめる
_pool: "queue.LifoQueue[tuple[pymysql.connections.Connection, float]]" = queue.LifoQueue(maxsize=POOL_MAX_IDLE)


def _close_quietly(conn) -> None:
    try:
        conn.close()
    except Exception:
        pass


def _acquire():
    """プールから接続を1つ借りる。なければ新しく作る。長く使っていない接続は ping で確かめ、切れていれば捨てる"""
    while True:
        try:
            conn, last_used = _pool.get_nowait()
        except queue.Empty:
            return get_connection()
        if time.monotonic() - last_used < POOL_PING_AFTER:
            return conn
        try:
            conn.ping(reconnect=False)
            return conn
        except Exception:
            _close_quietly(conn)  # 切れていた → 捨てて次を見る


def _release(conn, broken: bool = False) -> None:
    """借りた接続を返す。壊れている・プールが満杯なら閉じる"""
    if broken or not conn.open:
        _close_quietly(conn)
        return
    try:
        _pool.put_nowait((conn, time.monotonic()))
    except queue.Full:
        _close_quietly(conn)


def fetch_all(query: str, params: tuple = ()) -> list[dict]:
    """SELECT を実行して、行を dict のリストで返す。
    値は params で渡す（SQL の中の %s に入る）。文字列に直接つなげると、入力次第で DB を壊される。"""
    conn = _acquire()
    ok = False
    try:
        with conn.cursor() as cur:
            cur.execute(query, params)
            rows = cur.fetchall()
        ok = True
        return rows
    finally:
        _release(conn, broken=not ok)


@contextmanager
def db_cursor():
    """読み取り用。1回の接続で複数の SELECT を実行する。
    1つのAPIで何本も SELECT する場合に使う（接続はプールから1つ借りて、最後に返す）。

    使い方：
        with db_cursor() as cur:
            cur.execute("SELECT ...", (値,))
            rows = cur.fetchall()
    """
    conn = _acquire()
    ok = False
    try:
        with conn.cursor() as cur:
            yield cur
        ok = True
    finally:
        _release(conn, broken=not ok)


# ── ここから追加（口コミ機能 #6・#7・#11 で使う）─────────────────
@contextmanager
def transaction():
    """書き込み（INSERT / UPDATE）用。with の中の処理をまとめて1回で確定する。
    途中でエラーが起きたら全部取り消す（例：評価履歴だけ入って件数が増えない、を防ぐ）。

    使い方：
        with transaction() as cur:
            cur.execute("INSERT ...", (値, 値))
            cur.execute("UPDATE ...", (値,))
    """
    conn = _acquire()
    broken = False
    try:
        conn.begin()
        with conn.cursor() as cur:
            yield cur
        conn.commit()  # ここまで来たら確定
    except Exception:
        try:
            conn.rollback()  # エラーなら取り消し
        except Exception:
            broken = True  # 取り消しもできない＝接続が壊れている
        raise
    finally:
        # GET_LOCK（口コミIDの採番などで使う名前付きロック）は接続ごとに残るので、返す前に必ず外す
        if not broken:
            try:
                with conn.cursor() as cur:
                    cur.execute("DO RELEASE_ALL_LOCKS()")
            except Exception:
                broken = True
        _release(conn, broken=broken)
