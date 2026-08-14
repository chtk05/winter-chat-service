import { renderHook } from "@testing-library/react";

import { useVisibleInterval } from "../use-visible-interval";

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useVisibleInterval", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    setVisibility("visible");
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("calls the callback on each tick while the tab is visible", () => {
    const callback = jest.fn();
    renderHook(() => useVisibleInterval(callback, 1000));

    jest.advanceTimersByTime(3000);

    expect(callback).toHaveBeenCalledTimes(3);
  });

  it("does NOT call the callback on a tick while the tab is hidden", () => {
    const callback = jest.fn();
    renderHook(() => useVisibleInterval(callback, 1000));

    setVisibility("hidden");
    jest.advanceTimersByTime(3000);

    expect(callback).not.toHaveBeenCalled();
  });

  it("calls the callback immediately when the tab becomes visible again", () => {
    const callback = jest.fn();
    renderHook(() => useVisibleInterval(callback, 1000));

    setVisibility("hidden");
    jest.advanceTimersByTime(500);
    callback.mockClear();

    setVisibility("visible");

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it("always calls the LATEST callback, not a stale closure", () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = renderHook(({ cb }) => useVisibleInterval(cb, 1000), {
      initialProps: { cb: first },
    });

    rerender({ cb: second });
    jest.advanceTimersByTime(1000);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("stops calling the callback after unmount", () => {
    const callback = jest.fn();
    const { unmount } = renderHook(() => useVisibleInterval(callback, 1000));

    unmount();
    jest.advanceTimersByTime(3000);

    expect(callback).not.toHaveBeenCalled();
  });
});
