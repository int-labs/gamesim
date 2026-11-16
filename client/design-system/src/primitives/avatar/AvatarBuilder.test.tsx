import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { AvatarBuilder } from "./AvatarBuilder";
import { parseAvatarUrl } from "./dicebear";

const last = (spy: ReturnType<typeof vi.fn>) => parseAvatarUrl(spy.mock.calls.at(-1)?.[0] as string);

describe("AvatarBuilder", () => {
  it("starts a team without an avatar from its name, in Thumbs, as today's fallback", async () => {
    render(<AvatarBuilder seed="Team Anakin" />);
    expect(await screen.findByRole("img", { name: "Your avatar" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Thumbs" })).toBeChecked();
  });

  it("keeps the choice of a part, as the address to save", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<AvatarBuilder seed="Team Anakin" defaultValue="https://api.dicebear.com/10.x/adventurer/svg?seed=Team%20Anakin" onValueChange={onValueChange} />);
    expect(await screen.findByRole("radio", { name: "Adventurer" })).toBeChecked();
    await user.click(await screen.findByRole("tab", { name: "Hair" }));
    await user.click(screen.getByRole("radio", { name: "Option 3" }));
    expect(last(onValueChange)).toEqual({ style: "adventurer", seed: "Team Anakin", choices: { hairVariant: "long03" } });
  });

  it("leaves an optional part out with None, and shows it again with a variant", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<AvatarBuilder seed="Team Anakin" defaultValue="https://api.dicebear.com/10.x/adventurer/svg?seed=Team%20Anakin" onValueChange={onValueChange} />);
    await user.click(await screen.findByRole("tab", { name: "Glasses" }));
    await user.click(screen.getByRole("radio", { name: "None" }));
    expect(last(onValueChange)?.choices).toEqual({ glassesProbability: "0" });
    await user.click(screen.getByRole("radio", { name: "Option 2" }));
    expect(last(onValueChange)?.choices).toEqual({ glassesProbability: "100", glassesVariant: "variant02" });
  });

  it("chooses a colour from the style's palette, and a background", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<AvatarBuilder seed="Team Anakin" defaultValue="https://api.dicebear.com/10.x/adventurer/svg?seed=Team%20Anakin" onValueChange={onValueChange} />);
    await user.click(await screen.findByRole("tab", { name: "Skin colour" }));
    await user.click(screen.getByRole("radio", { name: "Colour 2" }));
    expect(last(onValueChange)?.choices).toEqual({ skinColor: "ecad80" });
    await user.click(screen.getByRole("tab", { name: "Background" }));
    await user.click(screen.getByRole("radio", { name: "Colour 1" }));
    expect(last(onValueChange)?.choices).toEqual({ skinColor: "ecad80", backgroundColor: "b6e3f4" });
  });

  it("starts a new style afresh from the same seed, keeping the background", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <AvatarBuilder
        seed="Team Anakin"
        defaultValue="https://api.dicebear.com/10.x/adventurer/svg?seed=Team%20Anakin&backgroundColor=c0aede&hairVariant=long03"
        onValueChange={onValueChange}
      />,
    );
    await user.click(await screen.findByRole("radio", { name: "Lorelei" }));
    expect(last(onValueChange)).toEqual({ style: "lorelei", seed: "Team Anakin", choices: { backgroundColor: "c0aede" } });
  });

  it("draws a new avatar with Shuffle", async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(<AvatarBuilder seed="Team Anakin" onValueChange={onValueChange} />);
    await screen.findByRole("img", { name: "Your avatar" });
    await user.click(screen.getByRole("button", { name: "Shuffle" }));
    const shuffled = last(onValueChange);
    expect(shuffled?.style).toBe("thumbs");
    expect(shuffled?.seed).not.toBe("Team Anakin");
    expect(shuffled?.choices).toEqual({});
  });

  it("follows a value it is given", async () => {
    const { rerender } = render(<AvatarBuilder seed="Team Anakin" value="https://api.dicebear.com/10.x/micah/svg?seed=A" />);
    expect(await screen.findByRole("radio", { name: "Micah" })).toBeChecked();
    rerender(<AvatarBuilder seed="Team Anakin" value="https://api.dicebear.com/10.x/personas/svg?seed=A" />);
    expect(screen.getByRole("radio", { name: "Personas" })).toBeChecked();
  });
});
