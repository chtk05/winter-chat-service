import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { DashboardView } from "../dashboard-view";
import type { DashboardSummary } from "@/lib/api/types";

function summary(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    range: "today",
    generatedAt: "2026-08-12T10:00:00+07:00",
    timezone: "Asia/Bangkok",
    totalContacts: 42,
    activeToday: 7,
    unread: 3,
    messages: { inbound: 18, outbound: 11 },
    series: [
      { date: "2026-08-06", inbound: 3, outbound: 2 },
      { date: "2026-08-07", inbound: 4, outbound: 1 },
      { date: "2026-08-08", inbound: 6, outbound: 4 },
      { date: "2026-08-09", inbound: 2, outbound: 2 },
      { date: "2026-08-10", inbound: 5, outbound: 3 },
      { date: "2026-08-11", inbound: 8, outbound: 6 },
      { date: "2026-08-12", inbound: 18, outbound: 11 },
    ],
    recentActivity: [
      {
        conversationId: "c1",
        contactName: "Ploy Sirichai",
        direction: "inbound",
        snippet: "Is the lamp back in stock?",
        at: "2026-08-12T09:41:00+07:00",
      },
    ],
    ...overrides,
  };
}

const EMPTY: DashboardSummary = {
  range: "today",
  generatedAt: "2026-08-12T10:00:00+07:00",
  totalContacts: 0,
  activeToday: 0,
  unread: 0,
  messages: { inbound: 0, outbound: 0 },
  series: [
    { date: "2026-08-06", inbound: 0, outbound: 0 },
    { date: "2026-08-07", inbound: 0, outbound: 0 },
    { date: "2026-08-08", inbound: 0, outbound: 0 },
    { date: "2026-08-09", inbound: 0, outbound: 0 },
    { date: "2026-08-10", inbound: 0, outbound: 0 },
    { date: "2026-08-11", inbound: 0, outbound: 0 },
    { date: "2026-08-12", inbound: 0, outbound: 0 },
  ],
  recentActivity: [],
};

function renderDashboard(
  props: Partial<React.ComponentProps<typeof DashboardView>> = {},
) {
  const onRangeChange = jest.fn();
  render(
    <DashboardView
      summary={summary()}
      range="today"
      onRangeChange={onRangeChange}
      {...props}
    />,
  );
  return { onRangeChange };
}

describe("stat cards", () => {
  it("renders every F-003 metric from the response", () => {
    renderDashboard();

    const card = (label: string) =>
      screen.getByText(label).closest("div")!.parentElement!;

    expect(
      within(card("Total contacts")).getByTestId("stat-value"),
    ).toHaveTextContent("42");
    expect(
      within(card("Active today")).getByTestId("stat-value"),
    ).toHaveTextContent("7");
    expect(
      within(card("Unread contacts")).getByTestId("stat-value"),
    ).toHaveTextContent("3");
    expect(
      within(card("Messages in")).getByTestId("stat-value"),
    ).toHaveTextContent("18");
    expect(
      within(card("Messages out")).getByTestId("stat-value"),
    ).toHaveTextContent("11");
  });

  it("labels the unread figure as contacts, not messages", () => {
    renderDashboard();

    expect(screen.getByText("Unread contacts")).toBeInTheDocument();
    expect(screen.queryByText("Unread messages")).not.toBeInTheDocument();
  });
});

describe("bar chart", () => {
  it("plots exactly seven days", () => {
    renderDashboard();
    expect(screen.getAllByTestId("chart-bar")).toHaveLength(7);
  });

  it("plots the sum of inbound and outbound for each day", () => {
    renderDashboard();
    const bars = screen.getAllByTestId("chart-bar");

    expect(bars[0]).toHaveAttribute("data-total", "5");
    expect(bars[6]).toHaveAttribute("data-total", "29");
  });

  it("accents the most recent day, as the design does", () => {
    renderDashboard();
    const bars = screen.getAllByTestId("chart-bar");

    expect(bars[6]).toHaveStyle({ background: "#db2777" });
    expect(bars[0]).toHaveStyle({ background: "#e2e8f0" });
  });

  it("scales bar heights against the busiest day", () => {
    renderDashboard();
    const bars = screen.getAllByTestId("chart-bar");

    expect(bars[6]).toHaveStyle({ height: "100%" });
    expect(bars[0]).toHaveStyle({ height: "17%" });
  });
});

describe("day by day table", () => {
  it("renders one row per day with in, out and total", () => {
    renderDashboard();

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows).toHaveLength(7);

    const cells = within(rows[6]).getAllByRole("cell");
    expect(cells.map((c) => c.textContent)).toEqual([
      "2026-08-12",
      "18",
      "11",
      "29",
    ]);
  });
});

describe("range toggle", () => {
  it("offers only the two ranges F-003 specifies", () => {
    renderDashboard();
    const group = screen.getByRole("group", { name: "Summary range" });

    expect(
      within(group).getByRole("button", { name: "Today" }),
    ).toBeInTheDocument();
    expect(
      within(group).getByRole("button", { name: "7 days" }),
    ).toBeInTheDocument();
    expect(
      within(group).queryByRole("button", { name: "30 days" }),
    ).not.toBeInTheDocument();
  });

  it("reports a range change", async () => {
    const { onRangeChange } = renderDashboard();
    await userEvent.click(screen.getByRole("button", { name: "7 days" }));
    expect(onRangeChange).toHaveBeenCalledWith("7d");
  });
});

describe("empty data", () => {
  it("renders zeros, not placeholders or mock values", () => {
    renderDashboard({ summary: EMPTY });

    const values = screen
      .getAllByTestId("stat-value")
      .map((node) => node.textContent);

    expect(values).toEqual(["0", "0", "0", "0", "0"]);
    expect(values).not.toContain("—");
    expect(values).not.toContain("");
  });

  it("still plots seven zero-height bars rather than collapsing the chart", () => {
    renderDashboard({ summary: EMPTY });

    const bars = screen.getAllByTestId("chart-bar");
    expect(bars).toHaveLength(7);
    for (const bar of bars) {
      expect(bar).toHaveStyle({ height: "0%" });
      expect(bar).toHaveAttribute("data-total", "0");
    }
  });

  it("renders an empty state for recent activity", () => {
    renderDashboard({ summary: EMPTY });
    expect(screen.getByText("No activity yet.")).toBeInTheDocument();
  });
});

it("renders a day with inbound but no outbound", () => {
  renderDashboard({
    summary: summary({
      series: [{ date: "2026-08-12", inbound: 4, outbound: 0 }],
    }),
  });

  const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
  expect(cells.map((c) => c.textContent)).toEqual([
    "2026-08-12",
    "4",
    "0",
    "4",
  ]);
});

it("renders a loading skeleton, not real stats, before the first response", () => {
  renderDashboard({ summary: null, loading: true });

  expect(screen.getByTestId("dashboard-skeleton")).toBeInTheDocument();
  expect(screen.queryAllByTestId("stat-value")).toHaveLength(0);
});

it("surfaces a failed load", () => {
  renderDashboard({ summary: null, error: "Could not load the summary." });
  expect(screen.getByRole("alert")).toHaveTextContent(
    "Could not load the summary.",
  );
});

describe("excluded by D-020", () => {
  it("renders none of the design's out-of-scope metrics", () => {
    const { container } = render(
      <DashboardView
        summary={summary()}
        range="today"
        onRangeChange={jest.fn()}
      />,
    );
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/what they asked about/i);
    expect(text).not.toMatch(/who they were/i);
    expect(text).not.toMatch(/avg first reply/i);
    expect(text).not.toMatch(/busiest hour/i);
    expect(text).not.toMatch(/queries/i);
    expect(text).not.toMatch(/returning/i);
    expect(text).not.toMatch(/reopened/i);
  });

  it("offers no CSV download while OQ-18 is unanswered", () => {
    renderDashboard();
    expect(
      screen.queryByRole("button", { name: /download csv/i }),
    ).not.toBeInTheDocument();
  });

  it("reproduces no BARS fixture value from the design", () => {
    const { container } = render(
      <DashboardView summary={EMPTY} range="today" onRangeChange={jest.fn()} />,
    );
    const totals = screen
      .getAllByTestId("chart-bar")
      .map((bar) => bar.getAttribute("data-total"));

    expect(totals).not.toContain("21");
    expect(container.textContent).not.toContain("4m 12s");
  });
});
