import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ThreadPanel } from "../thread-panel";
import type { Conversation, Message } from "@/lib/api/types";

jest.mock("@/lib/api/client", () => ({
  listMessages: jest.fn(),
  sendMessage: jest.fn(),
  retryMessage: jest.fn(),
  setConversationStatus: jest.fn(),
  uploadImage: jest.fn(),
}));

jest.mock("@/components/ui/toast", () => ({
  toastManager: { add: jest.fn() },
}));

const api = require("@/lib/api/client") as {
  listMessages: jest.Mock;
  sendMessage: jest.Mock;
  retryMessage: jest.Mock;
  setConversationStatus: jest.Mock;
  uploadImage: jest.Mock;
};
const { toastManager } = require("@/components/ui/toast") as {
  toastManager: { add: jest.Mock };
};

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

const FIXED_NOW = new Date("2026-08-12T10:00:00+07:00");

function renderPanel(
  props: Partial<React.ComponentProps<typeof ThreadPanel>> = {},
) {
  const onConversationChange = jest.fn();

  render(
    <ThreadPanel
      conversation={CONVERSATION}
      onConversationChange={onConversationChange}
      listVisible
      onToggleList={jest.fn()}
      detailsVisible={false}
      onToggleDetails={jest.fn()}
      idFactory={() => "client-uuid-1"}
      now={() => FIXED_NOW}
      {...props}
    />,
  );

  return { onConversationChange };
}

function persisted(overrides: Partial<Message> = {}): Message {
  return {
    id: "server-1",
    conversationId: "c1",
    clientId: "client-uuid-1",
    direction: "outbound",
    messageType: "text",
    text: "On the 12th.",
    deliveryStatus: "sending",
    createdAt: FIXED_NOW.toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  api.listMessages.mockResolvedValue({
    items: [],
    hasMore: false,
    nextCursor: null,
  });
  URL.createObjectURL = jest.fn(() => "blob:preview-1");
  URL.revokeObjectURL = jest.fn();
});

function imageFile(name = "photo.jpg"): File {
  return new File([new Uint8Array([1, 2, 3])], name, { type: "image/jpeg" });
}

function imagePersisted(overrides: Partial<Message> = {}): Message {
  return {
    id: "server-img-1",
    conversationId: "c1",
    clientId: "client-uuid-1",
    direction: "outbound",
    messageType: "image",
    text: null,
    mediaUrl: "https://storage.test/chat-media/outbound/x.jpg",
    deliveryStatus: "sending",
    createdAt: FIXED_NOW.toISOString(),
    ...overrides,
  };
}

describe("optimistic send", () => {
  it("renders a sending bubble immediately, before the server answers", async () => {
    let resolveSend: (message: Message) => void = () => {};
    api.sendMessage.mockReturnValue(
      new Promise<Message>((resolve) => {
        resolveSend = resolve;
      }),
    );

    renderPanel();
    await userEvent.type(
      screen.getByLabelText("Reply message"),
      "On the 12th.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Send reply" }));

    const bubble = await screen.findByTestId("message-bubble");
    expect(bubble).toHaveAttribute("data-delivery-status", "sending");
    expect(bubble).toHaveTextContent("On the 12th.");

    resolveSend(persisted());
  });

  it("sends the trimmed text with the generated clientId", async () => {
    api.sendMessage.mockResolvedValue(persisted());

    renderPanel();
    await userEvent.type(screen.getByLabelText("Reply message"), "  hello  ");
    await userEvent.click(screen.getByRole("button", { name: "Send reply" }));

    await waitFor(() =>
      expect(api.sendMessage).toHaveBeenCalledWith("c1", {
        text: "hello",
        clientId: "client-uuid-1",
        closeAfterSend: false,
      }),
    );
  });

  it("reconciles the optimistic bubble in place rather than duplicating it", async () => {
    api.sendMessage.mockResolvedValue(persisted({ sentVia: "reply" }));

    renderPanel();
    await userEvent.type(
      screen.getByLabelText("Reply message"),
      "On the 12th.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Send reply" }));

    await waitFor(() =>
      expect(screen.getByText("sent to LINE")).toBeInTheDocument(),
    );
    expect(screen.getAllByTestId("message-bubble")).toHaveLength(1);
  });

  it("clears the draft after sending", async () => {
    api.sendMessage.mockResolvedValue(persisted());

    renderPanel();
    const input = screen.getByLabelText("Reply message");
    await userEvent.type(input, "On the 12th.");
    await userEvent.click(screen.getByRole("button", { name: "Send reply" }));

    await waitFor(() => expect(input).toHaveValue(""));
  });

  it("sends on Enter", async () => {
    api.sendMessage.mockResolvedValue(persisted());

    renderPanel();
    await userEvent.type(
      screen.getByLabelText("Reply message"),
      "On the 12th.{Enter}",
    );

    await waitFor(() => expect(api.sendMessage).toHaveBeenCalledTimes(1));
  });

  it("cannot send an empty message", async () => {
    renderPanel();

    expect(screen.getByRole("button", { name: "Send reply" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send & close" })).toBeDisabled();
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it("cannot send a whitespace-only message", async () => {
    renderPanel();
    await userEvent.type(screen.getByLabelText("Reply message"), "    ");

    expect(screen.getByRole("button", { name: "Send reply" })).toBeDisabled();
    await userEvent.keyboard("{Enter}");
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it("marks a failed send failed, and the bubble does not vanish", async () => {
    api.sendMessage.mockRejectedValue(new Error("network"));

    renderPanel();
    await userEvent.type(
      screen.getByLabelText("Reply message"),
      "On the 12th.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Send reply" }));

    const bubble = await screen.findByTestId("message-bubble");
    await waitFor(() =>
      expect(bubble).toHaveAttribute("data-delivery-status", "failed"),
    );
    expect(bubble).toHaveTextContent("On the 12th.");
    expect(
      within(bubble).getByRole("button", { name: "Retry" }),
    ).toBeInTheDocument();
  });
});

describe("Send & close (D-019 atomicity)", () => {
  it("closes the conversation when the send succeeds", async () => {
    api.sendMessage.mockResolvedValue(persisted());
    const { onConversationChange } = renderPanel();

    await userEvent.type(screen.getByLabelText("Reply message"), "All sorted.");
    await userEvent.click(screen.getByRole("button", { name: "Send & close" }));

    await waitFor(() =>
      expect(api.sendMessage).toHaveBeenCalledWith("c1", {
        text: "All sorted.",
        clientId: "client-uuid-1",
        closeAfterSend: true,
      }),
    );
    await waitFor(() =>
      expect(onConversationChange).toHaveBeenCalledWith(
        expect.objectContaining({ status: "Closed" }),
      ),
    );
  });

  it("leaves the status visibly unchanged when the send fails", async () => {
    api.sendMessage.mockRejectedValue(new Error("network"));
    const { onConversationChange } = renderPanel();

    await userEvent.type(screen.getByLabelText("Reply message"), "All sorted.");
    await userEvent.click(screen.getByRole("button", { name: "Send & close" }));

    await waitFor(() =>
      expect(screen.getByTestId("message-bubble")).toHaveAttribute(
        "data-delivery-status",
        "failed",
      ),
    );

    expect(onConversationChange).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Conversation status")).toHaveValue("Open");
  });
});

describe("status change confirmation toast", () => {
  it("shows a success toast naming the new status", async () => {
    api.setConversationStatus.mockResolvedValue({
      ...CONVERSATION,
      status: "Pending",
    });

    renderPanel();
    await userEvent.selectOptions(
      screen.getByLabelText("Conversation status"),
      "Pending",
    );

    await waitFor(() =>
      expect(toastManager.add).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Status changed to Pending",
          type: "success",
        }),
      ),
    );
  });

  it("shows an error toast, and reverts the status, when the change fails", async () => {
    api.setConversationStatus.mockRejectedValue(new Error("network"));
    const { onConversationChange } = renderPanel();

    await userEvent.selectOptions(
      screen.getByLabelText("Conversation status"),
      "Closed",
    );

    await waitFor(() =>
      expect(toastManager.add).toHaveBeenCalledWith(
        expect.objectContaining({ type: "error" }),
      ),
    );
    expect(onConversationChange).toHaveBeenCalledWith(
      expect.objectContaining({ status: "Open" }),
    );
  });
});

describe("retry", () => {
  it("re-sends with the same clientId when the message never reached the server", async () => {
    api.sendMessage.mockRejectedValueOnce(new Error("network"));

    renderPanel();
    await userEvent.type(
      screen.getByLabelText("Reply message"),
      "On the 12th.",
    );
    await userEvent.click(screen.getByRole("button", { name: "Send reply" }));

    await screen.findByRole("button", { name: "Retry" });

    api.sendMessage.mockResolvedValueOnce(persisted());
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(api.sendMessage).toHaveBeenCalledTimes(2));
    expect(api.sendMessage).toHaveBeenLastCalledWith("c1", {
      text: "On the 12th.",
      clientId: "client-uuid-1",
    });
    expect(screen.getAllByTestId("message-bubble")).toHaveLength(1);
  });

  it("uses the retry endpoint for a message the server did persist", async () => {
    api.listMessages.mockResolvedValue({
      items: [
        persisted({
          id: "server-9",
          clientId: "client-uuid-old",
          deliveryStatus: "failed",
          failureReason: "LINE rejected the push",
        }),
      ],
      hasMore: false,
      nextCursor: null,
    });
    api.retryMessage.mockResolvedValue(
      persisted({
        id: "server-9",
        clientId: "client-uuid-old",
        deliveryStatus: "sending",
      }),
    );

    renderPanel();

    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));

    await waitFor(() =>
      expect(api.retryMessage).toHaveBeenCalledWith("server-9"),
    );
    expect(api.sendMessage).not.toHaveBeenCalled();
  });

  it("returns the bubble to failed when the retry itself fails", async () => {
    api.listMessages.mockResolvedValue({
      items: [
        persisted({
          id: "server-9",
          clientId: "client-uuid-old",
          deliveryStatus: "failed",
        }),
      ],
      hasMore: false,
      nextCursor: null,
    });
    api.retryMessage.mockRejectedValue(new Error("still down"));

    renderPanel();
    await userEvent.click(await screen.findByRole("button", { name: "Retry" }));

    await waitFor(() =>
      expect(screen.getByTestId("message-bubble")).toHaveAttribute(
        "data-delivery-status",
        "failed",
      ),
    );
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });
});

describe("image send (D-058)", () => {
  it("renders a local preview bubble immediately, before upload resolves", async () => {
    let resolveUpload: (result: { url: string }) => void = () => {};
    api.uploadImage.mockReturnValue(
      new Promise((resolve) => {
        resolveUpload = resolve;
      }),
    );
    api.sendMessage.mockResolvedValue(imagePersisted());

    renderPanel();
    const input = screen.getByTestId("image-file-input");
    await userEvent.upload(input, imageFile());

    const bubble = await screen.findByTestId("message-bubble");
    expect(bubble).toHaveAttribute("data-delivery-status", "sending");
    expect(bubble.querySelector("img")).toHaveAttribute(
      "src",
      "blob:preview-1",
    );

    resolveUpload({ url: "https://storage.test/chat-media/outbound/x.jpg" });
  });

  it("uploads then sends with the resulting mediaUrl and the generated clientId", async () => {
    api.uploadImage.mockResolvedValue({
      url: "https://storage.test/chat-media/outbound/x.jpg",
    });
    api.sendMessage.mockResolvedValue(imagePersisted());

    renderPanel();
    await userEvent.upload(screen.getByTestId("image-file-input"), imageFile());

    await waitFor(() =>
      expect(api.uploadImage).toHaveBeenCalledWith(imageFile()),
    );
    await waitFor(() =>
      expect(api.sendMessage).toHaveBeenCalledWith("c1", {
        mediaUrl: "https://storage.test/chat-media/outbound/x.jpg",
        clientId: "client-uuid-1",
      }),
    );
  });

  it("reconciles the preview bubble in place with the persisted row", async () => {
    api.uploadImage.mockResolvedValue({
      url: "https://storage.test/chat-media/outbound/x.jpg",
    });
    api.sendMessage.mockResolvedValue(imagePersisted({ sentVia: "push" }));

    renderPanel();
    await userEvent.upload(screen.getByTestId("image-file-input"), imageFile());

    await waitFor(() =>
      expect(screen.getByText("sent to LINE")).toBeInTheDocument(),
    );
    expect(screen.getAllByTestId("message-bubble")).toHaveLength(1);
  });

  it("marks a failed upload failed, and offers retry", async () => {
    api.uploadImage.mockRejectedValue(new Error("network"));

    renderPanel();
    await userEvent.upload(screen.getByTestId("image-file-input"), imageFile());

    const bubble = await screen.findByTestId("message-bubble");
    await waitFor(() =>
      expect(bubble).toHaveAttribute("data-delivery-status", "failed"),
    );
    expect(
      within(bubble).getByRole("button", { name: "Retry" }),
    ).toBeInTheDocument();
  });

  it("retry RE-UPLOADS the cached file rather than resending the local preview url", async () => {
    api.uploadImage.mockRejectedValueOnce(new Error("network"));

    renderPanel();
    await userEvent.upload(screen.getByTestId("image-file-input"), imageFile());
    await screen.findByRole("button", { name: "Retry" });

    api.uploadImage.mockResolvedValueOnce({
      url: "https://storage.test/chat-media/outbound/x.jpg",
    });
    api.sendMessage.mockResolvedValueOnce(imagePersisted());
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(api.uploadImage).toHaveBeenCalledTimes(2));
    await waitFor(() =>
      expect(api.sendMessage).toHaveBeenCalledWith("c1", {
        mediaUrl: "https://storage.test/chat-media/outbound/x.jpg",
        clientId: "client-uuid-1",
      }),
    );
    expect(screen.getAllByTestId("message-bubble")).toHaveLength(1);
  });

  it("rejects a non-image file with an error toast, never calls onSendImage", async () => {
    renderPanel();
    const input = screen.getByTestId("image-file-input");
    const video = new File([new Uint8Array([1])], "clip.mp4", {
      type: "video/mp4",
    });

    fireEvent.change(input, { target: { files: [video] } });

    await waitFor(() =>
      expect(toastManager.add).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "That file isn't an image",
          type: "error",
        }),
      ),
    );
    expect(api.uploadImage).not.toHaveBeenCalled();
    expect(screen.queryByTestId("message-bubble")).not.toBeInTheDocument();
  });
});

describe("paging (D-026)", () => {
  it("requests the initial page on mount and a cursor page on demand", async () => {
    api.listMessages
      .mockResolvedValueOnce({
        items: [persisted({ id: "m2", clientId: null })],
        hasMore: true,
        nextCursor: "cursor-1",
      })
      .mockResolvedValueOnce({
        items: [
          persisted({
            id: "m1",
            clientId: null,
            createdAt: "2026-08-11T09:00:00+07:00",
          }),
        ],
        hasMore: false,
        nextCursor: null,
      });

    renderPanel();

    await waitFor(() => expect(api.listMessages).toHaveBeenCalledWith("c1"));

    await userEvent.click(
      await screen.findByRole("button", { name: "Load full history" }),
    );

    await waitFor(() =>
      expect(api.listMessages).toHaveBeenLastCalledWith("c1", {
        before: "cursor-1",
      }),
    );
    await waitFor(() =>
      expect(screen.getAllByTestId("message-bubble")).toHaveLength(2),
    );
  });

  it("surfaces a failed page load without dropping the loaded messages", async () => {
    api.listMessages
      .mockResolvedValueOnce({
        items: [persisted({ id: "m2", clientId: null })],
        hasMore: true,
        nextCursor: "cursor-1",
      })
      .mockRejectedValueOnce(new Error("boom"));

    renderPanel();

    await userEvent.click(
      await screen.findByRole("button", { name: "Load full history" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not load older messages.",
    );
    expect(screen.getAllByTestId("message-bubble")).toHaveLength(1);
  });
});
