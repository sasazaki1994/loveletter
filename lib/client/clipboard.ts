export type CopyResult =
  | { ok: true; method: "clipboard" | "execCommand" }
  | { ok: false; error: string };

function copyWithExecCommand(text: string): boolean {
  if (typeof document === "undefined") return false;
  try {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "true");
    textarea.style.position = "fixed";
    textarea.style.top = "0";
    textarea.style.left = "-9999px";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);

    const active = document.activeElement as HTMLElement | null;
    textarea.focus();
    textarea.select();
    textarea.setSelectionRange(0, textarea.value.length);

    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    active?.focus?.();
    return ok;
  } catch {
    return false;
  }
}

export async function copyToClipboard(text: string): Promise<CopyResult> {
  const value = text ?? "";
  if (!value) return { ok: false, error: "empty" };
  if (typeof window === "undefined") return { ok: false, error: "no_window" };

  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(value);
      return { ok: true, method: "clipboard" };
    }
  } catch {
    // fall through to execCommand
  }

  const ok = copyWithExecCommand(value);
  return ok ? { ok: true, method: "execCommand" } : { ok: false, error: "copy_failed" };
}


