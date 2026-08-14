import { render, screen } from "@testing-library/react";

import { DetailsPanel, truncateLineUserId } from "../details-panel";
import type { Conversation } from "@/lib/api/types";

const CONVERSATION: Conversation = {
  id: "cly8f2c0000abcd1234471",
  contact: {
    id: "contact-1",
    lineUserId: "U8f2c0000000000000000000000004471",
    displayName: "Nattapong",
    avatarUrl: null,
    firstSeenAt: "2026-08-12T03:00:00.000Z",
  },
  status: "Open",
  unread: false,
  lastMessageAt: "2026-08-13T09:00:00.000Z",
  channel: "LINE",
  messageCount: 14,
};

describe("DetailsPanel — positive cases (T-020, D-052)", () => {
  it("renders the contact's name and the LINE channel", () => {
    render(<DetailsPanel conversation={CONVERSATION} />);

    expect(screen.getByText("Nattapong")).toBeInTheDocument();
    expect(screen.getByText("LINE")).toBeInTheDocument();
  });

  it("shows the LINE user id TRUNCATED, as openapi.yaml specifies", () => {
    render(<DetailsPanel conversation={CONVERSATION} />);

    expect(screen.getByText("U8f2c…4471")).toBeInTheDocument();
    // The full id must not be rendered — the contract says truncated.
    expect(
      screen.queryByText(CONVERSATION.contact.lineUserId),
    ).not.toBeInTheDocument();
  });

  it("shows first seen, status and message count", () => {
    render(<DetailsPanel conversation={CONVERSATION} />);

    expect(screen.getByText("12 Aug 2026")).toBeInTheDocument();
    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("14")).toBeInTheDocument();
  });

  it("reads the design's 'session id' as the conversation id (D-052)", () => {
    render(<DetailsPanel conversation={CONVERSATION} />);

    expect(screen.getByText("cly8f2…4471")).toBeInTheDocument();
  });

  it("renders the avatar when the contact has one", () => {
    render(
      <DetailsPanel
        conversation={{
          ...CONVERSATION,
          contact: { ...CONVERSATION.contact, avatarUrl: "https://line/a.jpg" },
        }}
      />,
    );

    expect(document.querySelector("img")).toHaveAttribute(
      "src",
      "https://line/a.jpg",
    );
  });

  it("is labelled for assistive technology", () => {
    render(<DetailsPanel conversation={CONVERSATION} />);

    expect(
      screen.getByRole("complementary", { name: /conversation details/i }),
    ).toBeInTheDocument();
  });
});

describe("DetailsPanel — negative cases", () => {
  it("renders an empty state, not a broken panel, with no conversation selected", () => {
    render(<DetailsPanel conversation={null} />);

    expect(screen.getByText(/select a conversation/i)).toBeInTheDocument();
  });

  it("renders 0 rather than blank for a conversation with no messages", () => {
    render(
      <DetailsPanel
        conversation={{ ...CONVERSATION, messageCount: undefined }}
      />,
    );

    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("renders an em dash rather than 'Invalid Date' for a malformed timestamp", () => {
    render(
      <DetailsPanel
        conversation={{
          ...CONVERSATION,
          contact: { ...CONVERSATION.contact, firstSeenAt: "not-a-date" },
        }}
      />,
    );

    expect(screen.getByText("—")).toBeInTheDocument();
    expect(screen.queryByText(/invalid date/i)).not.toBeInTheDocument();
  });

  it("renders no image element when the contact has no avatar", () => {
    render(<DetailsPanel conversation={CONVERSATION} />);

    expect(document.querySelector("img")).toBeNull();
  });

  it("carries NONE of what D-019 removed — this panel does not reverse it", () => {
    // OQ-35 is still open. If assigned-to, tags or notes ever return, that is a new
    // decision and a new task, not a quiet addition here.
    const { container } = render(<DetailsPanel conversation={CONVERSATION} />);

    expect(container.textContent).not.toMatch(/assigned/i);
    expect(container.textContent).not.toMatch(/\btags?\b/i);
    expect(container.textContent).not.toMatch(/notes?/i);
  });

  it("renders no field the contract does not define (§3.2)", () => {
    const { container } = render(<DetailsPanel conversation={CONVERSATION} />);

    // The design's remaining panel fields that map to no recorded concept.
    expect(container.textContent).not.toMatch(/session id/i);
    expect(container.textContent).not.toMatch(/priority/i);
    expect(container.textContent).not.toMatch(/sentiment/i);
  });
});

describe("truncateLineUserId", () => {
  it("produces the design's U8f2c…4471 form", () => {
    expect(truncateLineUserId("U8f2c0000000000000000000000004471")).toBe(
      "U8f2c…4471",
    );
  });

  it.each([
    ["an empty id", ""],
    ["a short id", "U123"],
    ["exactly ten characters", "U123456789"],
  ])(
    "leaves %s untouched rather than producing a nonsense ellipsis",
    (_l, id) => {
      expect(truncateLineUserId(id)).toBe(id);
    },
  );
});
