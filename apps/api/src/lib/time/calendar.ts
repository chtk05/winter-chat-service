/**
 * D-014: the dashboard's calendar days are Asia/Bangkok, and the zone must be
 * "configurable in one place, not scattered through queries". This module is that one
 * place — it is a source-level constant rather than an environment variable, which is why
 * `.env.example` deliberately does not list it.
 *
 * Everything here works in real time zones via `Intl` rather than adding a fixed +7
 * offset. Thailand has not observed daylight saving since 1955, so the arithmetic would
 * agree today, but a hardcoded offset is a claim about the zone that this code has no
 * business making.
 */
export const DASHBOARD_TIME_ZONE = "Asia/Bangkok";

/** `YYYY-MM-DD` for the calendar day an instant falls on, in the given zone. */
export function zonedDayKey(
  instant: Date,
  timeZone: string = DASHBOARD_TIME_ZONE,
): string {
  // `en-CA` formats as YYYY-MM-DD, which is exactly the contract's `format: date`.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

/** The UTC instant at which the given zone's calendar day begins. */
export function startOfZonedDay(
  instant: Date,
  timeZone: string = DASHBOARD_TIME_ZONE,
): Date {
  const [year, month, day] = zonedDayKey(instant, timeZone)
    .split("-")
    .map(Number);

  // Midnight in the zone, expressed as UTC: take the wall-clock midnight as though it
  // were UTC, then subtract the zone's offset AT that moment (not at `instant`, which may
  // be on the other side of a transition in zones that have them).
  const wallClockMidnight = Date.UTC(year, month - 1, day);

  return new Date(
    wallClockMidnight - zoneOffsetMs(new Date(wallClockMidnight), timeZone),
  );
}

/**
 * The last `days` calendar days in the given zone, oldest first, ending with the day
 * `instant` falls on. Seven of these back the design's bar chart (D-020).
 */
export function recentDayKeys(
  instant: Date,
  days: number,
  timeZone: string = DASHBOARD_TIME_ZONE,
): string[] {
  const today = startOfZonedDay(instant, timeZone);
  const keys: string[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
    // Stepping back in whole days from a known day-start, then re-deriving the key in the
    // zone, so a DST transition shifts the boundary rather than duplicating a key.
    const stepped = new Date(today.getTime() - offset * 24 * 60 * 60 * 1000);
    keys.push(zonedDayKey(stepped, timeZone));
  }

  return keys;
}

function zoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);

  const read = (type: Intl.DateTimeFormatPartTypes): number =>
    Number(parts.find((part) => part.type === type)?.value ?? "0");

  const asIfUtc = Date.UTC(
    read("year"),
    read("month") - 1,
    read("day"),
    // `hour12: false` renders midnight as 24 in some ICU versions; normalise it.
    read("hour") % 24,
    read("minute"),
    read("second"),
  );

  return asIfUtc - instant.getTime();
}
