/**
 * Visible error reporting. index.html installs window.__srReport (an inline script, so it works even
 * if the game bundle fails to evaluate). Game code reports shader/context/loop failures through here.
 */
declare global { interface Window { __srReport?: (title: string, detail?: string) => void } }

export function report(title: string, detail = ""): void {
  console.error(`[Sticker Runners] ${title}`, detail);
  try { window.__srReport?.(title, detail); } catch { /* overlay must never throw */ }
}
