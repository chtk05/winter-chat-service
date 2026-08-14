import { render, screen } from "@testing-library/react";

import { BottomTabBar } from "../bottom-tab-bar";

const mockPathname = jest.fn<string, []>();

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

describe("BottomTabBar", () => {
  beforeEach(() => {
    mockPathname.mockReturnValue("/inbox");
  });

  it("renders both sections", () => {
    render(<BottomTabBar />);

    expect(screen.getByRole("link", { name: /inbox/i })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /dashboard/i }),
    ).toBeInTheDocument();
  });

  it("marks Inbox current when the route is /inbox", () => {
    mockPathname.mockReturnValue("/inbox");
    render(<BottomTabBar />);

    expect(screen.getByRole("link", { name: /inbox/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(
      screen.getByRole("link", { name: /dashboard/i }),
    ).not.toHaveAttribute("aria-current");
  });

  it("marks Dashboard current when the route is /dashboard", () => {
    mockPathname.mockReturnValue("/dashboard");
    render(<BottomTabBar />);

    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /inbox/i })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks neither section current on a route outside the console", () => {
    mockPathname.mockReturnValue("/login");
    render(<BottomTabBar />);

    expect(screen.getByRole("link", { name: /inbox/i })).not.toHaveAttribute(
      "aria-current",
    );
    expect(
      screen.getByRole("link", { name: /dashboard/i }),
    ).not.toHaveAttribute("aria-current");
  });

  it("does not crash when the pathname is null", () => {
    mockPathname.mockReturnValue(null as unknown as string);
    expect(() => render(<BottomTabBar />)).not.toThrow();
  });
});
