// How long something has waited, counting Monday to Friday only (UTC), so a
// weekend never ages a lead. Fractional: Friday 17:00 to Tuesday 17:00 is 2.
const DAY = 86_400_000;

export function businessDaysBetween(from: Date, to: Date): number {
  let t = from.getTime();
  const end = to.getTime();
  if (!Number.isFinite(t) || !Number.isFinite(end)) return 0;
  let ms = 0;
  while (t < end) {
    const stop = Math.min((Math.floor(t / DAY) + 1) * DAY, end);
    const weekday = new Date(t).getUTCDay();
    if (weekday !== 0 && weekday !== 6) ms += stop - t;
    t = stop;
  }
  return ms / DAY;
}
