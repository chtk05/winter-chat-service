import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ThreadView } from "../thread-view";
import type { Conversation, Message } from "@/lib/api/types";

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

  it("reflects and reports the List switch", async () => {
    const { onToggleList } = renderThread();

    const listSwitch = screen.getByRole("switch");
    expect(listSwitch).toHaveAttribute("aria-checked", "true");

    await userEvent.click(listSwitch);

    expect(onToggleList).toHaveBeenCalledTimes(1);
  });

  it("reflects and reports the Details chevron", async () => {
    const { onToggleDetails } = renderThread({ detailsVisible: false });

    const detailsButton = screen.getByRole("button", { name: "Show details" });
    expect(detailsButton).toHaveAttribute("aria-expanded", "false");
    expect(detailsButton).toHaveTextContent("«");

    await userEvent.click(detailsButton);

    expect(onToggleDetails).toHaveBeenCalledTimes(1);
  });

  it("the Details chevron flips direction when the panel is open", () => {
    renderThread({ detailsVisible: true });

    const detailsButton = screen.getByRole("button", { name: "Hide details" });
    expect(detailsButton).toHaveAttribute("aria-expanded", "true");
    expect(detailsButton).toHaveTextContent("»");
  });

  it("shows the contact's LINE avatar when present", () => {
    const { view } = renderThread({
      conversation: {
        ...CONVERSATION,
        contact: { ...CONVERSATION.contact, avatarUrl: "https://line/pic.jpg" },
      },
    });

    const avatar = view.container.querySelector("img");
    expect(avatar).toHaveAttribute("src", "https://line/pic.jpg");
  });

  it("falls back to initials when the contact has no avatar", () => {
    const { view } = renderThread();

    expect(view.container.querySelector("img")).not.toBeInTheDocument();
    expect(screen.getByText("PS")).toBeInTheDocument();
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

  it.each(["sticker", "location", "file"])(
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

  it("renders an image message's mediaUrl as an img, not a placeholder", () => {
    const { view } = renderThread({
      messages: [
        message({
          messageType: "image",
          text: null,
          mediaUrl: "https://storage.test/chat-media/inbound/msg-1.jpg",
        }),
      ],
    });

    expect(
      screen.queryByTestId("unsupported-placeholder"),
    ).not.toBeInTheDocument();
    const img = view.container.querySelector(
      '[data-testid="message-bubble"] img',
    );
    expect(img).toHaveAttribute(
      "src",
      "https://storage.test/chat-media/inbound/msg-1.jpg",
    );
  });

  it("renders 'Image unavailable' for an image message with no mediaUrl", () => {
    renderThread({
      messages: [message({ messageType: "image", text: null, mediaUrl: null })],
    });

    expect(screen.getByTestId("image-unavailable")).toHaveTextContent(
      "Image unavailable",
    );
    expect(
      screen.queryByTestId("unsupported-placeholder"),
    ).not.toBeInTheDocument();
  });

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

  it("hides the control when the server reports no more history", () => {
    renderThread({ hasMore: false });

    expect(
      screen.queryByRole("button", { name: "Load full history" }),
    ).not.toBeInTheDocument();
  });

  it("disables the control while a page is loading", async () => {
    const { onLoadMore } = renderThread({ hasMore: true, loadingMore: true });

    const button = screen.getByRole("button", { name: "Loading…" });
    expect(button).toBeDisabled();

    await userEvent.click(button);
    expect(onLoadMore).not.toHaveBeenCalled();
  });

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
