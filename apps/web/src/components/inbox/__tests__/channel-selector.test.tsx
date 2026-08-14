import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ChannelSelector } from "../channel-selector";

/**
 * T-012 verification: "LINE is the only enabled option".
 * Negative case required by D-018: clicking a disabled channel button fires no send.
 */

describe("ChannelSelector", () => {
  it("renders the design's three channels", () => {
    render(<ChannelSelector />);

    expect(screen.getByRole("button", { name: "LINE" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Facebook" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "WhatsApp" }),
    ).toBeInTheDocument();
  });

  it("enables LINE and nothing else", () => {
    render(<ChannelSelector />);

    expect(screen.getByRole("button", { name: "LINE" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Facebook" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "WhatsApp" })).toBeDisabled();
  });

  it("renders inert channels with the design's 0.45 opacity and not-allowed cursor", () => {
    render(<ChannelSelector />);

    for (const name of ["Facebook", "WhatsApp"]) {
      const button = screen.getByRole("button", { name });
      expect(button).toHaveStyle({ opacity: "0.45", cursor: "not-allowed" });
    }

    expect(screen.getByRole("button", { name: "LINE" })).toHaveStyle({
      opacity: "1",
      cursor: "pointer",
    });
  });

  it("labels inert channels as not connected", () => {
    render(<ChannelSelector />);

    expect(screen.getByRole("button", { name: "Facebook" })).toHaveAttribute(
      "title",
      "Not connected yet",
    );
  });

  /**
   * D-018's required negative case. The buttons carry no click handler at all —
   * a disabled button cannot dispatch one, and this asserts the behaviour rather
   * than the absence of a prop.
   */
  it("fires nothing when a disabled channel is clicked", async () => {
    const onAnyClick = jest.fn();
    const { container } = render(
      <div onClick={onAnyClick}>
        <ChannelSelector />
      </div>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Facebook" }));
    await userEvent.click(screen.getByRole("button", { name: "WhatsApp" }));

    expect(onAnyClick).not.toHaveBeenCalled();
    expect(container).toBeTruthy();
  });

  it("bubbles a click from the enabled channel, proving the test above is meaningful", async () => {
    const onAnyClick = jest.fn();
    render(
      <div onClick={onAnyClick}>
        <ChannelSelector />
      </div>,
    );

    await userEvent.click(screen.getByRole("button", { name: "LINE" }));

    expect(onAnyClick).toHaveBeenCalledTimes(1);
  });

  it("renders no channel D-018 excludes from the selector", () => {
    const { container } = render(<ChannelSelector />);
    expect(container.textContent).not.toContain("Web widget");
  });
});
