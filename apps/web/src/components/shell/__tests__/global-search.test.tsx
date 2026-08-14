import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { GlobalSearch } from "../global-search";

const mockPush = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("@/lib/api/client", () => ({
  listConversations: jest.fn(),
}));

const { listConversations } = jest.requireMock("@/lib/api/client") as {
  listConversations: jest.Mock;
};

function conversation(id: string, displayName: string, snippet: string) {
  return {
    id,
    contact: {
      id: `contact-${id}`,
      lineUserId: `U${id}0000000000000000000000000000`,
      displayName,
      firstSeenAt: "2026-08-04T13:58:00+07:00",
    },
    status: "Open" as const,
    unread: false,
    snippet,
    lastMessageAt: "2026-08-12T09:41:00+07:00",
    channel: "LINE" as const,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  mockPush.mockReset();
  listConversations.mockReset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("GlobalSearch", () => {
  it("is closed by default — no dialog, no input", () => {
    render(<GlobalSearch />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("opens the search dialog when the trigger is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<GlobalSearch />);

    await user.click(
      screen.getByRole("button", { name: /search conversations/i }),
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("prompts before anything is typed, without calling the API", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<GlobalSearch />);
    await user.click(
      screen.getByRole("button", { name: /search conversations/i }),
    );

    expect(
      screen.getByText("Search by contact name or message text."),
    ).toBeInTheDocument();
    expect(listConversations).not.toHaveBeenCalled();
  });

  it("debounces the search — no call until the debounce window elapses", async () => {
    listConversations.mockResolvedValue({
      items: [],
      totals: { matching: 0, all: 0, open: 0 },
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<GlobalSearch />);
    await user.click(
      screen.getByRole("button", { name: /search conversations/i }),
    );

    fireEvent.change(screen.getByLabelText("Search people or messages"), {
      target: { value: "ploy" },
    });

    expect(listConversations).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() =>
      expect(listConversations).toHaveBeenCalledWith({ search: "ploy" }),
    );
  });

  it("renders matching results with contact name and snippet", async () => {
    listConversations.mockResolvedValue({
      items: [conversation("c1", "Ploy Sirichai", "Is the lamp back?")],
      totals: { matching: 1, all: 4, open: 2 },
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<GlobalSearch />);
    await user.click(
      screen.getByRole("button", { name: /search conversations/i }),
    );

    fireEvent.change(screen.getByLabelText("Search people or messages"), {
      target: { value: "ploy" },
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(await screen.findByText("Ploy Sirichai")).toBeInTheDocument();
    expect(screen.getByText("Is the lamp back?")).toBeInTheDocument();
  });

  it("renders a no-match state when the search returns nothing", async () => {
    listConversations.mockResolvedValue({
      items: [],
      totals: { matching: 0, all: 4, open: 2 },
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<GlobalSearch />);
    await user.click(
      screen.getByRole("button", { name: /search conversations/i }),
    );

    fireEvent.change(screen.getByLabelText("Search people or messages"), {
      target: { value: "zzzz" },
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(
      await screen.findByText("No conversations match."),
    ).toBeInTheDocument();
  });

  it("navigates to the conversation and closes the dialog when a result is picked", async () => {
    listConversations.mockResolvedValue({
      items: [conversation("c1", "Ploy Sirichai", "Is the lamp back?")],
      totals: { matching: 1, all: 4, open: 2 },
    });
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<GlobalSearch />);
    await user.click(
      screen.getByRole("button", { name: /search conversations/i }),
    );
    fireEvent.change(screen.getByLabelText("Search people or messages"), {
      target: { value: "ploy" },
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    await user.click(await screen.findByText("Ploy Sirichai"));

    expect(mockPush).toHaveBeenCalledWith("/inbox?open=c1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape without navigating", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<GlobalSearch />);
    await user.click(
      screen.getByRole("button", { name: /search conversations/i }),
    );

    fireEvent.keyDown(screen.getByLabelText("Search people or messages"), {
      key: "Escape",
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("closes when the close button is clicked", async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<GlobalSearch />);
    await user.click(
      screen.getByRole("button", { name: /search conversations/i }),
    );

    await user.click(screen.getByRole("button", { name: /close search/i }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not crash and shows the no-match state when the search request fails", async () => {
    listConversations.mockRejectedValue(new Error("network down"));
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    render(<GlobalSearch />);
    await user.click(
      screen.getByRole("button", { name: /search conversations/i }),
    );

    fireEvent.change(screen.getByLabelText("Search people or messages"), {
      target: { value: "ploy" },
    });
    await act(async () => {
      jest.advanceTimersByTime(300);
    });

    expect(
      await screen.findByText("No conversations match."),
    ).toBeInTheDocument();
  });
});
