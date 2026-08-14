import {
  DASHBOARD_TIME_ZONE,
  recentDayKeys,
  startOfZonedDay,
  zonedDayKey,
} from "@/lib/time/calendar";

describe("D-014: Asia/Bangkok calendar days", () => {
  it("names the zone in exactly one place", () => {
    expect(DASHBOARD_TIME_ZONE).toBe("Asia/Bangkok");
  });

  it("puts an instant on its Bangkok day, not its UTC day", () => {
    expect(zonedDayKey(new Date("2026-08-12T18:30:00.000Z"))).toBe(
      "2026-08-13",
    );
  });

  it("computes the UTC instant at which a Bangkok day begins", () => {
    expect(startOfZonedDay(new Date("2026-08-13T09:00:00.000Z"))).toEqual(
      new Date("2026-08-12T17:00:00.000Z"),
    );
  });

  it("returns seven day keys, oldest first, ending on today", () => {
    const keys = recentDayKeys(new Date("2026-08-13T09:00:00.000Z"), 7);

    expect(keys).toEqual([
      "2026-08-07",
      "2026-08-08",
      "2026-08-09",
      "2026-08-10",
      "2026-08-11",
      "2026-08-12",
      "2026-08-13",
    ]);
  });

  it("crosses a month boundary correctly", () => {
    expect(recentDayKeys(new Date("2026-09-02T09:00:00.000Z"), 7)).toEqual([
      "2026-08-27",
      "2026-08-28",
      "2026-08-29",
      "2026-08-30",
      "2026-08-31",
      "2026-09-01",
      "2026-09-02",
    ]);
  });
});

describe("boundary cases the dashboard's negative tests rest on", () => {
  it("places a message exactly at Bangkok midnight on the NEW day", () => {
    const midnight = new Date("2026-08-12T17:00:00.000Z");

    expect(zonedDayKey(midnight)).toBe("2026-08-13");
    expect(startOfZonedDay(midnight)).toEqual(midnight);
  });

  it("places a message one millisecond before Bangkok midnight on the OLD day", () => {
    expect(zonedDayKey(new Date("2026-08-12T16:59:59.999Z"))).toBe(
      "2026-08-12",
    );
  });

  it("is stable across the UTC midnight that falls mid-Bangkok-day", () => {
    expect(zonedDayKey(new Date("2026-08-12T23:00:00.000Z"))).toBe(
      "2026-08-13",
    );
    expect(zonedDayKey(new Date("2026-08-13T00:00:00.000Z"))).toBe(
      "2026-08-13",
    );
  });

  it("agrees with a zone that DOES observe daylight saving, proving no fixed offset", () => {
    expect(
      zonedDayKey(new Date("2026-07-14T23:30:00.000Z"), "Europe/London"),
    ).toBe("2026-07-15");
    expect(
      startOfZonedDay(new Date("2026-07-15T12:00:00.000Z"), "Europe/London"),
    ).toEqual(new Date("2026-07-14T23:00:00.000Z"));
  });

  it("handles a zone west of UTC", () => {
    expect(
      zonedDayKey(new Date("2026-08-13T03:00:00.000Z"), "America/New_York"),
    ).toBe("2026-08-12");
  });
});
