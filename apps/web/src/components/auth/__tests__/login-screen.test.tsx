import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { LoginScreen } from "../login-screen";
import { ApiError } from "@/lib/api/client";

/**
 * T-005 verification. Phase 2 (D-022): the API is a test double — no route
 * handler, no database, no LINE.
 */

jest.mock("@/lib/api/client", () => {
  const actual = jest.requireActual("@/lib/api/client");
  return { ...actual, login: jest.fn() };
});

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { login } = require("@/lib/api/client") as {
  login: jest.Mock;
};

describe("LoginScreen", () => {
  beforeEach(() => {
    login.mockReset();
  });

  it("renders D-017 copy, not the design's invite-code copy", () => {
    render(<LoginScreen onAuthenticated={jest.fn()} />);

    expect(screen.getByLabelText("Access code")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enter workspace" }),
    ).toBeInTheDocument();
  });

  it("posts the trimmed code and reports success", async () => {
    login.mockResolvedValue(undefined);
    const onAuthenticated = jest.fn();
    render(<LoginScreen onAuthenticated={onAuthenticated} />);

    await userEvent.type(screen.getByLabelText("Access code"), "  wc-live  ");
    await userEvent.click(screen.getByRole("button", { name: "Enter workspace" }));

    await waitFor(() => expect(login).toHaveBeenCalledWith("wc-live"));
    expect(onAuthenticated).toHaveBeenCalledTimes(1);
  });

  it("renders the error card with code and ref from the D-021 body", async () => {
    login.mockRejectedValue(
      new ApiError(401, {
        code: "INVALID_ACCESS_CODE",
        message: "That access code didn't work",
        ref: "4471-A",
      }),
    );
    render(<LoginScreen onAuthenticated={jest.fn()} />);

    await userEvent.type(screen.getByLabelText("Access code"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Enter workspace" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("error INVALID_ACCESS_CODE · ref 4471-A");
    expect(alert).toHaveTextContent("That access code didn't work");
  });

  it("omits the ref clause when the error body carries no ref", async () => {
    login.mockRejectedValue(
      new ApiError(401, { code: "INVALID_ACCESS_CODE", message: "Nope" }),
    );
    render(<LoginScreen onAuthenticated={jest.fn()} />);

    await userEvent.type(screen.getByLabelText("Access code"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Enter workspace" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("error INVALID_ACCESS_CODE");
    expect(alert).not.toHaveTextContent("ref");
  });

  // Negative case: empty submission blocked client-side.
  it("does not call the API on an empty submission", async () => {
    render(<LoginScreen onAuthenticated={jest.fn()} />);

    expect(screen.getByRole("button", { name: "Enter workspace" })).toBeDisabled();
    await userEvent.click(screen.getByRole("button", { name: "Enter workspace" }));

    expect(login).not.toHaveBeenCalled();
  });

  // Negative case: whitespace-only is also blocked.
  it("does not call the API when the code is only whitespace", async () => {
    render(<LoginScreen onAuthenticated={jest.fn()} />);

    await userEvent.type(screen.getByLabelText("Access code"), "   ");

    expect(screen.getByRole("button", { name: "Enter workspace" })).toBeDisabled();
    expect(login).not.toHaveBeenCalled();
  });

  // Negative case: a rate-limited response renders the error card, not a blank state.
  it("renders the error card on a 429 rather than blanking", async () => {
    login.mockRejectedValue(
      new ApiError(429, {
        code: "RATE_LIMITED",
        message: "Too many attempts. Try again shortly.",
        ref: "9001-B",
      }),
    );
    render(<LoginScreen onAuthenticated={jest.fn()} />);

    await userEvent.type(screen.getByLabelText("Access code"), "guess");
    await userEvent.click(screen.getByRole("button", { name: "Enter workspace" }));

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("error RATE_LIMITED · ref 9001-B");
    expect(alert).toHaveTextContent("Too many attempts. Try again shortly.");
  });

  // Negative case: a non-ApiError rejection still surfaces a card.
  it("renders a card when the request fails outside the D-021 shape", async () => {
    login.mockRejectedValue(new TypeError("Failed to fetch"));
    render(<LoginScreen onAuthenticated={jest.fn()} />);

    await userEvent.type(screen.getByLabelText("Access code"), "abc");
    await userEvent.click(screen.getByRole("button", { name: "Enter workspace" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "error NETWORK_ERROR",
    );
  });

  it("returns to the form from the error card", async () => {
    login.mockRejectedValue(
      new ApiError(401, { code: "INVALID_ACCESS_CODE", message: "Nope" }),
    );
    render(<LoginScreen onAuthenticated={jest.fn()} />);

    await userEvent.type(screen.getByLabelText("Access code"), "nope");
    await userEvent.click(screen.getByRole("button", { name: "Enter workspace" }));
    await userEvent.click(
      await screen.findByRole("button", { name: "Try another code" }),
    );

    expect(screen.getByLabelText("Access code")).toHaveValue("");
  });

  /**
   * Negative case required by T-005: no copy in the rendered output mentions
   * LINE account linking, code expiry, or single use (all removed by D-017).
   */
  it("renders no LINE-linking, expiry or single-use copy", () => {
    const { container } = render(<LoginScreen onAuthenticated={jest.fn()} />);
    const text = container.textContent ?? "";

    expect(text).not.toMatch(/invite code/i);
    expect(text).not.toMatch(/single.use/i);
    expect(text).not.toMatch(/7 days/i);
    expect(text).not.toMatch(/expire/i);
    expect(text).not.toMatch(/linked to this LINE account/i);
    expect(text).not.toMatch(/signed in as/i);
    expect(text).not.toMatch(/WC-2026/);
  });

  it("does not reproduce the design's fixture code as a placeholder", () => {
    render(<LoginScreen onAuthenticated={jest.fn()} />);
    expect(screen.getByLabelText("Access code")).not.toHaveAttribute(
      "placeholder",
      "WC-2026",
    );
  });
});
