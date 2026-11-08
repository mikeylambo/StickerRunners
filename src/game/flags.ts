/** URL flags (GDD §32): ?god ?slow=0.25 ?tells ?quick, plus ?step (manual stepping) and ?bot (autopilot). */
export interface Flags {
  god: boolean;
  slow: number;
  tells: boolean;
  quick: boolean;
  step: boolean;
  bot: boolean;
}

export function readFlags(search = typeof location !== "undefined" ? location.search : ""): Flags {
  const q = new URLSearchParams(search);
  const slow = Number(q.get("slow"));
  return {
    god: q.has("god"),
    slow: q.has("slow") && Number.isFinite(slow) && slow > 0 ? Math.min(slow, 4) : 1,
    tells: q.has("tells"),
    quick: q.has("quick"),
    step: q.has("step"),
    bot: q.has("bot")
  };
}
