/**
 * Time as an injected collaborator.
 *
 * AGENTS.md (Dependency Inversion) requires services to take the clock as an explicit
 * argument rather than reaching for `Date.now()` internally — session expiry (D-008) is
 * time-dependent, and none of its negative cases are testable if time is a hidden global.
 */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = {
  now: () => new Date(),
};

/** A clock pinned to a fixed instant, for tests that assert time-dependent behaviour. */
export function fixedClock(instant: Date): Clock {
  return { now: () => new Date(instant.getTime()) };
}
