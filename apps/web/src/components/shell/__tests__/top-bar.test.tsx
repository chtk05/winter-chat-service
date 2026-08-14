import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { TopBar } from "../top-bar";

/**
 * T-002 verification: "segmented control reflects the active route".
 * Phase 2 rule (D-022): no real route handler, no Prisma, no LINE — routing is mocked.
 */

const mockPathname = jest.fn<string, []>();

jest.mock("next/navigation", () => ({
  usePathname: () => mockPathname(),
}));

describe("TopBar", () => {
  beforeEach(() => {
    mockPathname.mockReturnValue("/inbox");
  });

  it("renders the brand, the console badge and both sections", () => {
    render(<TopBar />);

    expect(screen.getByText("WinterChat")).toBeInTheDocument();
    expect(screen.getByText("admin console")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Inbox" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
  });

  it("marks Inbox current when the route is /inbox", () => {
    mockPathname.mockReturnValue("/inbox");
    render(<TopBar />);

    expect(screen.getByRole("link", { name: "Inbox" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  it("marks Dashboard current when the route is /dashboard", () => {
    mockPathname.mockReturnValue("/dashboard");
    render(<TopBar />);

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Inbox" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  // Negative case: an unrelated route must not light up either tab.
  it("marks neither section current on a route outside the console", () => {
    mockPathname.mockReturnValue("/login");
    render(<TopBar />);

    expect(screen.getByRole("link", { name: "Inbox" })).not.toHaveAttribute(
      "aria-current",
    );
    expect(screen.getByRole("link", { name: "Dashboard" })).not.toHaveAttribute(
      "aria-current",
    );
  });

  // Negative case: usePathname returns null during some render passes.
  it("does not crash when the pathname is null", () => {
    mockPathname.mockReturnValue(null as unknown as string);
    expect(() => render(<TopBar />)).not.toThrow();
  });

  it("renders the hardcoded D-018 channel indicator", () => {
    render(<TopBar />);
    expect(screen.getByText("1 of 4 channels live")).toBeInTheDocument();
  });

  it("calls onSignOut when the sign-out control is used", async () => {
    const onSignOut = jest.fn();
    render(<TopBar onSignOut={onSignOut} />);

    await userEvent.click(screen.getByRole("button", { name: "Sign out" }));

    expect(onSignOut).toHaveBeenCalledTimes(1);
  });

  /**
   * D-017 negative case: no per-agent identity anywhere in the shell. The design
   * puts "AM" initials in this control; D-002/D-009 create no user to name.
   */
  it("renders no per-agent identity from the design fixtures", () => {
    const { container } = render(<TopBar />);
    const text = container.textContent ?? "";

    expect(text).not.toContain("AM");
    expect(text).not.toContain("Aom");
    expect(text).not.toMatch(/signed in as/i);
  });
});
