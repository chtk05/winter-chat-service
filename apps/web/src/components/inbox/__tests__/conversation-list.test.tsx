import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ConversationList } from "../conversation-list";
import type {
  ConversationListResponse,
  ConversationStatus,
  ConversationSummary,
} from "@/lib/api/types";

const NOW = new Date("2026-08-12T10:00:00+07:00");

function conversation(
  id: string,
  overrides: Partial<ConversationSummary> = {},
): ConversationSummary {
  return {
    id,
    contact: {
      id: `contact-${id}`,
      lineUserId: `U${id}0000000000000000000000000000`,
      displayName: "Ploy Sirichai",
      firstSeenAt: "2026-08-04T13:58:00+07:00",
    },
    status: "Open" as ConversationStatus,
    unread: false,
    snippet: "Is the walnut desk lamp back in stock?",
    lastMessageAt: "2026-08-12T09:41:00+07:00",
    channel: "LINE",
    ...overrides,
  };
}

function response(
  items: ConversationSummary[],
  totals?: Partial<ConversationListResponse["totals"]>,
): ConversationListResponse {
  return {
    items,
    totals: {
      matching: items.length,
      all: items.length,
      open: items.filter((c) => c.status === "Open").length,
      ...totals,
    },
  };
}

function renderList(
  props: Partial<React.ComponentProps<typeof ConversationList>> = {},
) {
  const onSelect = jest.fn();
  const onFilterChange = jest.fn();
  const onSearchChange = jest.fn();

  render(
    <ConversationList
      data={response([conversation("c1")])}
      search=""
      onSearchChange={onSearchChange}
      filter="All"
      onFilterChange={onFilterChange}
      activeId={null}
      onSelect={onSelect}
      now={NOW}
      {...props}
    />,
  );

  return { onSelect, onFilterChange, onSearchChange };
}

describe("ConversationList", () => {
  it("renders rows in the order the server returned them", () => {
    renderList({
      data: response([
        conversation("c1", {
          contact: { ...conversation("c1").contact, displayName: "Newest" },
          lastMessageAt: "2026-08-12T09:41:00+07:00",
        }),
        conversation("c2", {
          contact: { ...conversation("c2").contact, displayName: "Older" },
          lastMessageAt: "2026-08-11T09:12:00+07:00",
        }),
      ]),
    });

    const options = screen.getAllByRole("option");
    expect(options).toHaveLength(2);
    expect(options[0]).toHaveTextContent("Newest");
    expect(options[1]).toHaveTextContent("Older");
  });

  it("renders the design's row furniture", () => {
    renderList({
      data: response([conversation("c1", { status: "Pending", unread: true })]),
    });

    const row = screen.getByRole("option");
    expect(row).toHaveTextContent("Ploy Sirichai");
    expect(row).toHaveTextContent("Is the walnut desk lamp back in stock?");
    expect(row).toHaveTextContent("LINE");
    expect(within(row).getByText("Pending")).toBeInTheDocument();
    expect(within(row).getByTestId("unread-dot")).toBeInTheDocument();
  });

  it("shows the unread dot only when unread is true", () => {
    renderList({ data: response([conversation("c1", { unread: false })]) });
    expect(screen.queryByTestId("unread-dot")).not.toBeInTheDocument();
  });

  it("marks the active row selected", () => {
    renderList({
      data: response([conversation("c1"), conversation("c2")]),
      activeId: "c2",
    });

    const options = screen.getAllByRole("option");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
  });

  it("reports the selected conversation id", async () => {
    const { onSelect } = renderList({
      data: response([conversation("c1"), conversation("c2")]),
    });

    await userEvent.click(screen.getAllByRole("option")[1]);
    expect(onSelect).toHaveBeenCalledWith("c2");
  });

  it("renders the footer count line from the server totals", () => {
    renderList({
      data: response([conversation("c1")], { matching: 1, all: 4, open: 2 }),
    });

    expect(
      screen.getByText("1 of 4 conversations · 2 open"),
    ).toBeInTheDocument();
  });

  describe("filter pills", () => {
    it("renders all four D-019 filters with the active one pressed", () => {
      renderList({ filter: "Pending" });

      expect(screen.getByRole("button", { name: "All" })).toHaveAttribute(
        "aria-pressed",
        "false",
      );
      expect(screen.getByRole("button", { name: "Pending" })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
    });

    it("reports a filter change", async () => {
      const { onFilterChange } = renderList();
      await userEvent.click(screen.getByRole("button", { name: "Closed" }));
      expect(onFilterChange).toHaveBeenCalledWith("Closed");
    });
  });

  describe("search", () => {
    it("reports each keystroke upward", async () => {
      const { onSearchChange } = renderList();
      await userEvent.type(
        screen.getByLabelText("Search people or messages"),
        "l",
      );
      expect(onSearchChange).toHaveBeenCalledWith("l");
    });
  });

  it("renders an empty state when there are no conversations at all", () => {
    renderList({ data: response([]) });

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No conversations yet.")).toBeInTheDocument();
  });

  it("renders an empty state, not a stale list, when a filter matches nothing", () => {
    renderList({ data: response([]), filter: "Closed" });

    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(screen.getByText("No conversations match.")).toBeInTheDocument();
  });

  it("renders an empty state when a search matches nothing", () => {
    renderList({ data: response([]), search: "zzzz" });

    expect(screen.getByText("No conversations match.")).toBeInTheDocument();
  });

  it("treats a whitespace-only search as no search in the empty state", () => {
    renderList({ data: response([]), search: "   " });

    expect(screen.getByText("No conversations yet.")).toBeInTheDocument();
  });

  it("renders no empty state while a page is still loading", () => {
    renderList({ data: null, loading: true });

    expect(screen.queryByText("No conversations yet.")).not.toBeInTheDocument();
    expect(
      screen.queryByText("No conversations match."),
    ).not.toBeInTheDocument();
  });

  it("renders a loading skeleton before the first page arrives", () => {
    renderList({ data: null, loading: true });

    expect(
      screen.getByTestId("conversation-list-skeleton"),
    ).toBeInTheDocument();
  });

  it("renders no skeleton once real rows are showing", () => {
    renderList({ data: response([conversation("c1")]), loading: false });

    expect(
      screen.queryByTestId("conversation-list-skeleton"),
    ).not.toBeInTheDocument();
  });

  it("renders no footer count before any page has arrived", () => {
    renderList({ data: null, loading: true });
    expect(screen.queryByText(/conversations ·/)).not.toBeInTheDocument();
  });

  it("renders no design fixture data", () => {
    const { container } = render(
      <ConversationList
        data={response([])}
        search=""
        onSearchChange={jest.fn()}
        filter="All"
        onFilterChange={jest.fn()}
        activeId={null}
        onSelect={jest.fn()}
        now={NOW}
      />,
    );
    const text = container.textContent ?? "";

    expect(text).not.toContain("Nattapong");
    expect(text).not.toContain("Mia Chen");
    expect(text).not.toContain("Somchai");
  });

  describe("mobile masthead", () => {
    it("shows the open/total counts once a page has arrived", () => {
      renderList({
        data: response(
          [
            conversation("c1", { status: "Open" }),
            conversation("c2", { status: "Closed" }),
          ],
          { open: 1, all: 4 },
        ),
      });

      expect(screen.getByText("1 open · 4 total · LINE")).toBeInTheDocument();
    });

    it("falls back to the channel name alone before any page has arrived", () => {
      renderList({ data: null, loading: true });

      expect(screen.getAllByText("LINE").length).toBeGreaterThan(0);
      expect(screen.queryByText(/open ·/)).not.toBeInTheDocument();
    });

    it("renders the signed-in admin's initials", () => {
      renderList({ adminName: "Aom Malee" });

      expect(screen.getByText("AM")).toBeInTheDocument();
    });

    it("renders a placeholder when no admin name is available", () => {
      renderList({ adminName: null });

      expect(screen.getByText("?")).toBeInTheDocument();
    });
  });
});
