import { render, screen } from "@testing-library/react";

import NotFound from "../not-found";

/** T-002 verification: "404 renders"; negative case "unknown route → 404". */

describe("NotFound", () => {
  it("renders the design's 404 card", () => {
    render(<NotFound />);

    expect(screen.getByText("404")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /this page isn't here/i }),
    ).toBeInTheDocument();
  });

  it("offers both of the design's routes out", () => {
    render(<NotFound />);

    expect(screen.getByRole("link", { name: "Back to inbox" })).toHaveAttribute(
      "href",
      "/inbox",
    );
    expect(screen.getByRole("link", { name: "Go to sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("prints the real error code", () => {
    render(<NotFound />);
    expect(screen.getByText(/error PAGE_NOT_FOUND/)).toBeInTheDocument();
  });

  /**
   * Negative case (§3.5): the design's fixture reference "9F13-C" is mock data.
   * A ref is minted by the server for a real API failure (D-021); a static 404
   * has none, so none may be printed.
   */
  it("prints no fabricated support reference", () => {
    const { container } = render(<NotFound />);
    const text = container.textContent ?? "";

    expect(text).not.toContain("9F13-C");
    expect(text).not.toMatch(/\bref\b/);
  });
});
