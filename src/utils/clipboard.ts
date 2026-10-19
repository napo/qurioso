/** Clipboard API needs a secure context; classroom LANs commonly use plain HTTP. */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) { await navigator.clipboard.writeText(text); return true; }
  } catch { /* Try the selection-based fallback on HTTP or denied clipboard access. */ }
  const field = document.createElement('textarea');
  const focused = document.activeElement as HTMLElement | null;
  field.value = text;
  field.setAttribute('readonly', '');
  field.style.cssText = 'position:fixed;left:-9999px;top:0';
  document.body.appendChild(field);
  field.select();
  try { return Boolean(document.execCommand?.('copy')); }
  catch { return false; }
  finally { field.remove(); focused?.focus(); }
}
