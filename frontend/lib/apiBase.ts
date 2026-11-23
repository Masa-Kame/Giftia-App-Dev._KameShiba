// lib/apiBase.ts — FastAPI の場所（全APIで共通）
// NEXT_PUBLIC_ の値はブラウザに配られる＝秘密は置かない（.env.local に書く）
// 既定値は localhost ではなく 127.0.0.1（Windows で localhost が IPv6 から試され、応答が遅くなるのを防ぐ）
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
