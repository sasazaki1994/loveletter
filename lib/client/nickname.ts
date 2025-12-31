export const LAST_NICKNAME_KEY = "llr:lastNickname";

export function loadLastNickname(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(LAST_NICKNAME_KEY);
    return (raw ?? "").trim();
  } catch {
    return "";
  }
}

export function saveLastNickname(nickname: string) {
  if (typeof window === "undefined") return;
  const value = nickname.trim();
  if (!value) return;
  try {
    window.localStorage.setItem(LAST_NICKNAME_KEY, value);
  } catch {
    // ignore
  }
}


