export const DASHBOARD_TIME_ZONE = "Asia/Bangkok";

export function zonedDayKey(
  instant: Date,
  timeZone: string = DASHBOARD_TIME_ZONE,
): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(instant);
}

export function startOfZonedDay(
  instant: Date,
  timeZone: string = DASHBOARD_TIME_ZONE,
): Date {
  const [year, month, day] = zonedDayKey(instant, timeZone)
    .split("-")
    .map(Number);

  const wallClockMidnight = Date.UTC(year, month - 1, day);

  return new Date(
    wallClockMidnight - zoneOffsetMs(new Date(wallClockMidnight), timeZone),
  );
}

export function recentDayKeys(
  instant: Date,
  days: number,
  timeZone: string = DASHBOARD_TIME_ZONE,
): string[] {
  const today = startOfZonedDay(instant, timeZone);
  const keys: string[] = [];

  for (let offset = days - 1; offset >= 0; offset -= 1) {
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
    read("hour") % 24,
    read("minute"),
    read("second"),
  );

  return asIfUtc - instant.getTime();
}
