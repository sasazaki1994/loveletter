/**
 * 短い読みやすいルームIDを生成
 * 6文字の英数字（大文字のみ、紛らわしい文字を除外）
 */
const SHORT_ID_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // I, O, 0, 1を除外
const SHORT_ID_LENGTH = 6;

/**
 * 短いルームIDを生成
 */
export function generateShortRoomId(): string {
  const chars = SHORT_ID_CHARS;
  let result = '';
  
  // より安全な乱数生成（可能であればcrypto APIを使用）
  const crypto = typeof window !== 'undefined' ? window.crypto : globalThis.crypto;
  
  if (crypto && crypto.getRandomValues) {
    const values = new Uint32Array(SHORT_ID_LENGTH);
    crypto.getRandomValues(values);
    for (let i = 0; i < SHORT_ID_LENGTH; i++) {
      result += chars[values[i]! % chars.length];
    }
  } else {
    // フォールバック（Node.js環境など）
    for (let i = 0; i < SHORT_ID_LENGTH; i++) {
      result += chars[Math.floor(Math.random() * chars.length)];
    }
  }
  
  return result;
}

/**
 * 短いルームIDの形式を検証
 */
export function isValidShortRoomId(id: string): boolean {
  return /^[A-Z2-9]{6}$/.test(id);
}

/**
 * ルームIDを正規化（大文字に変換、空白を削除）
 */
export function normalizeRoomId(id: string): string {
  return id.trim().toUpperCase().replace(/\s+/g, '');
}

