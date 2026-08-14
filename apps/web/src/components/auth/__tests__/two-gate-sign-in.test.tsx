import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { JoinScreen } from "../join-screen";
import { LoginScreen, type AuthGate } from "../login-screen";
import { SignInScreen } from "../sign-in-screen";
import { ApiError, joinWorkspace } from "@/lib/api/client";

// `jest.mock` is hoisted above the imports by the SWC transform, so the static import
// above receives the mocked `joinWorkspace` while `ApiError` stays the real class.
jest.mock("@/lib/api/client", () => {
  const actual = jest.requireActual("@/lib/api/client");
  return { ...actual, joinWorkspace: jest.fn() };
});

const joinWorkspaceMock = joinWorkspace as jest.MockedFunction<
  typeof joinWorkspace
>;

beforeEach(() => joinWorkspaceMock.mockReset());

function renderGate(
  gate: AuthGate,
  overrides: Partial<Parameters<typeof LoginScreen>[0]> = {},
) {
  const props = {
    gate,
    onSignIn: jest.fn(),
    onSignOut: jest.fn(),
    onJoined: jest.fn(),
    onAlreadyMember: jest.fn(),
    ...overrides,
  };
  render(<LoginScreen {...props} />);
  return props;
}

describe("D-036 gate routing — the three states, which is where a security bug would appear", () => {
  it("shows the LINE entry point to an ANONYMOUS visitor", () => {
    renderGate({ status: "anonymous" });

    expect(
      screen.getByRole("button", { name: /sign in with line/i }),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText(/access code/i)).not.toBeInTheDocument();
  });

  it("shows the JOIN step to an authenticated-but-not-joined user", () => {
    renderGate({ status: "authenticated", displayName: "Aom" });

    expect(screen.getByLabelText(/access code/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /sign in with line/i }),
    ).not.toBeInTheDocument();
  });

  it("does NOT show the console to an authenticated-but-not-joined user", () => {
    // Treating "has a valid session" as "is a member" would admit any LINE user on the
    // platform. The join screen is what stands between the two.
    const props = renderGate({ status: "authenticated", displayName: "Aom" });

    expect(props.onAlreadyMember).not.toHaveBeenCalled();
    expect(props.onJoined).not.toHaveBeenCalled();
  });

  it("sends a MEMBER straight on, rendering neither gate", () => {
    const props = renderGate({ status: "member" });

    expect(props.onAlreadyMember).toHaveBeenCalled();
    expect(screen.queryByLabelText(/access code/i)).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /sign in with line/i }),
    ).not.toBeInTheDocument();
  });
});

describe("SignInScreen — gate one (D-035)", () => {
  it("starts the LINE flow when clicked", () => {
    const onSignIn = jest.fn();
    render(<SignInScreen onSignIn={onSignIn} />);

    fireEvent.click(screen.getByRole("button", { name: /sign in with line/i }));

    expect(onSignIn).toHaveBeenCalledTimes(1);
  });

  it("returns to the entry point with an alert when LINE sign-in was cancelled", () => {
    // Negative case: a cancelled round trip must not leave a blank state.
    render(
      <SignInScreen
        onSignIn={jest.fn()}
        error="LINE sign-in did not complete. Please try again."
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(/did not complete/i);
    expect(
      screen.getByRole("button", { name: /sign in with line/i }),
    ).toBeInTheDocument();
  });

  it("renders no error region when there is no error", () => {
    render(<SignInScreen onSignIn={jest.fn()} />);

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("JoinScreen — gate two (D-036, D-038, D-042)", () => {
  it("submits the TRIMMED code", async () => {
    joinWorkspaceMock.mockResolvedValue(undefined);
    const onJoined = jest.fn();
    render(
      <JoinScreen signedInAs="Aom" onJoined={onJoined} onSignOut={jest.fn()} />,
    );

    fireEvent.change(screen.getByLabelText(/access code/i), {
      target: { value: "  wc-live  " },
    });
    fireEvent.click(screen.getByRole("button", { name: /enter workspace/i }));

    await waitFor(() =>
      expect(joinWorkspaceMock).toHaveBeenCalledWith("wc-live"),
    );
    await waitFor(() => expect(onJoined).toHaveBeenCalled());
  });

  it("shows who is signed in — accurate under D-035, unlike D-017's banned copy", () => {
    render(
      <JoinScreen
        signedInAs="Aom"
        onJoined={jest.fn()}
        onSignOut={jest.fn()}
      />,
    );

    expect(screen.getByText(/signed in as/i)).toBeInTheDocument();
    expect(screen.getByText("Aom")).toBeInTheDocument();
  });

  it("falls back gracefully when LINE returned no display name", () => {
    render(
      <JoinScreen
        signedInAs={null}
        onJoined={jest.fn()}
        onSignOut={jest.fn()}
      />,
    );

    expect(screen.getByText(/your LINE account/i)).toBeInTheDocument();
  });

  it("offers a way back out for the wrong account", () => {
    const onSignOut = jest.fn();
    render(
      <JoinScreen
        signedInAs="Aom"
        onJoined={jest.fn()}
        onSignOut={onSignOut}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /not you/i }));

    expect(onSignOut).toHaveBeenCalled();
  });

  it("renders the error card with the D-021 code on a wrong join code", async () => {
    joinWorkspaceMock.mockRejectedValue(
      new ApiError(401, {
        code: "INVALID_ACCESS_CODE",
        message: "That access code didn't work.",
        ref: "4471-A",
      }),
    );
    const onJoined = jest.fn();
    render(
      <JoinScreen signedInAs="Aom" onJoined={onJoined} onSignOut={jest.fn()} />,
    );

    fireEvent.change(screen.getByLabelText(/access code/i), {
      target: { value: "WRONG" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enter workspace/i }));

    await screen.findByRole("alert");
    expect(screen.getByText(/error INVALID_ACCESS_CODE/)).toBeInTheDocument();
    expect(screen.getByText(/ref 4471-A/)).toBeInTheDocument();
    expect(onJoined).not.toHaveBeenCalled();
  });

  it("blocks an EMPTY submission client-side — the API is never called", async () => {
    render(
      <JoinScreen
        signedInAs="Aom"
        onJoined={jest.fn()}
        onSignOut={jest.fn()}
      />,
    );

    const submit = screen.getByRole("button", { name: /enter workspace/i });
    expect(submit).toBeDisabled();

    fireEvent.click(submit);
    expect(joinWorkspaceMock).not.toHaveBeenCalled();
  });

  it("blocks a WHITESPACE-ONLY submission client-side", () => {
    render(
      <JoinScreen
        signedInAs="Aom"
        onJoined={jest.fn()}
        onSignOut={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/access code/i), {
      target: { value: "    " },
    });

    expect(
      screen.getByRole("button", { name: /enter workspace/i }),
    ).toBeDisabled();
    expect(joinWorkspaceMock).not.toHaveBeenCalled();
  });

  it("renders a card rather than blanking on a non-ApiError rejection", async () => {
    joinWorkspaceMock.mockRejectedValue(new Error("network down"));
    render(
      <JoinScreen
        signedInAs="Aom"
        onJoined={jest.fn()}
        onSignOut={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/access code/i), {
      target: { value: "WC" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enter workspace/i }));

    await screen.findByRole("alert");
    expect(screen.getByText(/error NETWORK_ERROR/)).toBeInTheDocument();
  });

  it("returns to a CLEARED form on retry", async () => {
    joinWorkspaceMock.mockRejectedValue(
      new ApiError(401, {
        code: "INVALID_ACCESS_CODE",
        message: "That access code didn't work.",
      }),
    );
    render(
      <JoinScreen
        signedInAs="Aom"
        onJoined={jest.fn()}
        onSignOut={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/access code/i), {
      target: { value: "WRONG" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enter workspace/i }));
    await screen.findByRole("alert");

    fireEvent.click(screen.getByRole("button", { name: /try another code/i }));

    expect(screen.getByLabelText(/access code/i)).toHaveValue("");
  });

  it("omits the ref clause when the error body carries none", async () => {
    joinWorkspaceMock.mockRejectedValue(
      new ApiError(401, {
        code: "INVALID_ACCESS_CODE",
        message: "That access code didn't work.",
      }),
    );
    render(
      <JoinScreen
        signedInAs="Aom"
        onJoined={jest.fn()}
        onSignOut={jest.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText(/access code/i), {
      target: { value: "WRONG" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enter workspace/i }));
    await screen.findByRole("alert");

    expect(screen.queryByText(/ref /)).not.toBeInTheDocument();
  });

  it("reproduces none of the design's prototype fixtures (§3.5)", () => {
    const { container } = render(
      <JoinScreen
        signedInAs="Aom"
        onJoined={jest.fn()}
        onSignOut={jest.fn()}
      />,
    );

    // D-017 still bans the invented claims; D-035 only makes the LINE *account* language
    // accurate, not the single-use or expiry claims about the code.
    expect(container.textContent).not.toMatch(/single.use/i);
    expect(container.textContent).not.toMatch(/expire/i);
    expect(container.textContent).not.toMatch(/7 days/i);
    expect(container.textContent).not.toMatch(/WC-2026/);
  });
});
