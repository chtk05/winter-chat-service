import { act, renderHook, waitFor } from "@testing-library/react";

import { useInboxLive } from "../use-inbox-live";
import { waitForInboxActivity } from "@/lib/api/client";

jest.mock("@/lib/api/client", () => ({
  EMPTY_WATERMARK: "1970-01-01T00:00:00.000Z",
  waitForInboxActivity: jest.fn(),
}));

const waitMock = waitForInboxActivity as jest.Mock;

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, "visibilityState", {
    value: state,
    configurable: true,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useInboxLive", () => {
  beforeEach(() => {
    setVisibility("visible");
    waitMock.mockReset();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("calls onActivity when the watermark moves", async () => {
    const onActivity = jest.fn();
    let releaseWait:
      ((value: { changed: boolean; at: string }) => void) | null = null;

    waitMock
      .mockResolvedValueOnce({
        changed: false,
        at: "2026-08-14T08:00:00.000Z",
      })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            releaseWait = resolve;
          }),
      )
      .mockImplementation(() => new Promise(() => {}));

    renderHook(() => useInboxLive(onActivity));

    await waitFor(() => expect(waitMock).toHaveBeenCalledTimes(2));

    await act(async () => {
      releaseWait?.({
        changed: true,
        at: "2026-08-14T08:00:01.000Z",
      });
    });

    await waitFor(() => expect(onActivity).toHaveBeenCalledTimes(1));
  });

  it("does not call onActivity for an unchanged timeout", async () => {
    const onActivity = jest.fn();

    waitMock
      .mockResolvedValueOnce({
        changed: false,
        at: "2026-08-14T08:00:00.000Z",
      })
      .mockResolvedValueOnce({
        changed: false,
        at: "2026-08-14T08:00:00.000Z",
      })
      .mockImplementation(() => new Promise(() => {}));

    renderHook(() => useInboxLive(onActivity));

    await waitFor(() => expect(waitMock).toHaveBeenCalledTimes(3));

    expect(onActivity).not.toHaveBeenCalled();
  });
});
