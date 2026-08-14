import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ThreadView } from "../thread-view";
import type { Conversation, Message } from "@/lib/api/types";

/** T-007 verification, against a test double of the D-021 response shape. */

const CONVERSATION: Conversation = {
  id: "c1",
  contact: {
    id: "contact-1",
    lineUserId: "U8f2c00000000000000000000000004471",
    displayName: "Ploy Sirichai",
    firstSeenAt: "2026-08-04T13:58:00+07:00",
  },
  status: "Open",
  unread: false,
  lastMessageAt: "2026-08-12T09:41:00+07:00",
  channel: "LINE",
};

function message(overrides: Partial<Message> = {}): Message {
  return {
    id: "m1",
    conversationId: "c1",
    direction: "inbound",
    messageType: "text",
    text: "Is the walnut desk lamp back in stock?",
    createdAt: "2026-08-12T09:41:00+07:00",
    ...overrides,
  };
}

function renderThread(
  props: Partial<React.ComponentProps<typeof ThreadView>> = {},
) {
  const onLoadMore = jest.fn();
  const onStatusChange = jest.fn();
  const onToggleList = jest.fn();
  const onToggleDetails = jest.fn();

  const view = render(
    <ThreadView
      conversation={CONVERSATION}
      messages={[message()]}
      hasMore={false}
      loadingMore={false}
      onLoadMore={onLoadMore}
      onStatusChange={onStatusChange}
      listVisible
      onToggleList={onToggleList}
      detailsVisible={false}
      onToggleDetails={onToggleDetails}
      {...props}
    />,
  );

  return { view, onLoadMore, onStatusChange, onToggleList, onToggleDetails };
}

describe("ThreadView header", () => {
  it("renders the contact and the truncated LINE id", () => {
    renderThread();

    expect(
      screen.getByRole("heading", { name: "Ploy Sirichai" }),
    ).toBeInTheDocument();
    expect(screen.getByText("LINE · U8f2c…4471")).toBeInTheDocument();
  });

  it("renders the D-019 status select at the current status", () => {
    renderThread();
    expect(screen.getByLabelText("Conversation status")).toHaveValue("Open");
  });

  it("offers exactly the three D-019 statuses", () => {
    renderThread();
    const options = screen
      .getAllByRole("option")
      .map((option) => option.textContent);
    expect(options).toEqual(["Open", "Pending", "Closed"]);
  });

  it("reports a status change", async () => {
    const { onStatusChange } = renderThread();

    await userEvent.selectOptions(
      screen.getByLabelText("Conversation status"),
      "Closed",
    );

    expect(onStatusChange).toHaveBeenCalledWith("Closed");
  });

  it("reflects and reports both panel toggles", async () => {
    const { onToggleList, onToggleDetails } = renderThread();

    const switches = screen.getAllByRole("switch");
    expect(switches[0]).toHaveAttribute("aria-checked", "true");
    expect(switches[1]).toHaveAttribute("aria-checked", "false");

    await userEvent.click(switches[0]);
    await userEvent.click(switches[1]);

    expect(onToggleList).toHaveBeenCalledTimes(1);
    expect(onToggleDetails).toHaveBeenCalledTimes(1);
  });
});

describe("ThreadView messages", () => {
  it("distinguishes inbound from outbound", () => {
    renderThread({
      messages: [
        message({ id: "m1", direction: "inbound" }),
        message({ id: "m2", direction: "outbound", text: "On the 12th." }),
      ],
    });

    const bubbles = screen.getAllByTestId("message-bubble");
    expect(bubbles[0]).toHaveAttribute("data-direction", "inbound");
    expect(bubbles[1]).toHaveAttribute("data-direction", "outbound");
  });

  it("renders the via-badge only when the message was delivered to LINE", () => {
    renderThread({
      messages: [
        message({ id: "m1", direction: "outbound", sentVia: "reply" }),
        message({ id: "m2", direction: "inbound" }),
      ],
    });

    expect(screen.getAllByText("sent to LINE")).toHaveLength(1);
  });

  it("renders a Push-delivered message with the same badge (D-006)", () => {
    renderThread({
      messages: [message({ direction: "outbound", sentVia: "push" })],
    });

    expect(screen.getByText("sent to LINE")).toBeInTheDocument();
  });

  /** D-010: a non-text inbound renders as a placeholder carrying its LINE type. */
  it.each(["image", "sticker", "location", "file"])(
    "renders a %s placeholder with its LINE type",
    (messageType) => {
      renderThread({
        messages: [message({ messageType, text: null })],
      });

      expect(screen.getByTestId("unsupported-placeholder")).toHaveTextContent(
        `Unsupported message type: ${messageType}`,
      );
    },
  );

  it("renders a delivery failure with its reason and a retry control", async () => {
    const onRetryMessage = jest.fn();
    renderThread({
      messages: [
        message({
          id: "m9",
          direction: "outbound",
          deliveryStatus: "failed",
          failureReason: "LINE rejected the push",
        }),
      ],
      onRetryMessage,
    });

    expect(screen.getByText(/LINE rejected the push/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetryMessage).toHaveBeenCalledWith("m9");
  });

  // Negative case: an empty thread renders an empty state, not a spinner.
  it("renders an empty state for a thread with no messages", () => {
    renderThread({ messages: [] });

    expect(
      screen.getByText("No messages in this conversation yet."),
    ).toBeInTheDocument();
    expect(screen.queryByText("Loading…")).not.toBeInTheDocument();
  });

  it("renders a prompt when no conversation is selected", () => {
    renderThread({ conversation: null });

    expect(
      screen.getByText("Select a conversation to open its thread."),
    ).toBeInTheDocument();
  });
});

describe("ThreadView paging (D-026)", () => {
  it("offers Load full history when the server reports more", () => {
    renderThread({ hasMore: true });

    expect(
      screen.getByRole("button", { name: "Load full history" }),
    ).toBeInTheDocument();
  });

  it("requests the next page once per click", async () => {
    const { onLoadMore } = renderThread({ hasMore: true });

    await userEvent.click(
      screen.getByRole("button", { name: "Load full history" }),
    );

    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  // Negative case: hidden when there is nothing further to fetch.
  it("hides the control when the server reports no more history", () => {
    renderThread({ hasMore: false });

    expect(
      screen.queryByRole("button", { name: "Load full history" }),
    ).not.toBeInTheDocument();
  });

  // Negative case: the control must not fire twice while a page is in flight.
  it("disables the control while a page is loading", async () => {
    const { onLoadMore } = renderThread({ hasMore: true, loadingMore: true });

    const button = screen.getByRole("button", { name: "Loading…" });
    expect(button).toBeDisabled();

    await userEvent.click(button);
    expect(onLoadMore).not.toHaveBeenCalled();
  });

  // Negative case: a failed page load surfaces an error.
  it("surfaces a failed page load", () => {
    renderThread({
      hasMore: true,
      loadError: "Could not load older messages.",
    });

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Could not load older messages.",
    );
  });
});
