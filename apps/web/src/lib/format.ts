/**
 * Presentation-only formatting for the conversation list and thread.
 *
 * D-014 fixes Asia/Bangkok as the product's calendar zone for *dashboard*
 * metrics. These helpers render timestamps that the server already produced, so
 * they format in the zone passed in — defaulting to Asia/Bangkok for consistency
 * with D-014 rather than to the viewer's local zone, which would make two admins
 * see different day labels for the same message.
 */

export const DISPLAY_TIME_ZONE = "Asia/Bangkok";

function parts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [day, month, year] = formatter.format(date).split("/");
  return { year: Number(year), month: Number(month), day: Number(day) };
}

function dayIndex(date: Date, timeZone: string) {
  const { year, month, day } = parts(date, timeZone);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

/**
 * The design's row timestamp: clock time today, "Yest." yesterday, "MMM d"
 * beyond that.
 */
export function formatRowTimestamp(
  iso: string,
  now: Date = new Date(),
  timeZone: string = DISPLAY_TIME_ZONE,
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const diff = dayIndex(now, timeZone) - dayIndex(date, timeZone);

  if (diff === 0) {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(date);
  }

  if (diff === 1) return "Yest.";

  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
  }).format(date);
}

/** The design's bubble meta line: "Ploy · 14:02". */
export function formatMessageMeta(
  name: string,
  iso: string,
  timeZone: string = DISPLAY_TIME_ZONE,
): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return name;

  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);

  return `${name} · ${time}`;
}

/** Avatar initials, at most two characters. Empty when there is no usable name. */
export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

/** The design's truncated LINE id in the thread header ("U8f2c…4471"). */
export function truncateLineUserId(lineUserId: string): string {
  if (lineUserId.length <= 11) return lineUserId;
  return `${lineUserId.slice(0, 5)}…${lineUserId.slice(-4)}`;
}
