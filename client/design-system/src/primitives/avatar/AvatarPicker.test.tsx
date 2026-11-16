import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, vi, type Mock } from "vitest";
import { AvatarPicker, type AvatarChoice } from "./AvatarPicker";

const choiceSpy = () => vi.fn<(choice: AvatarChoice | null) => void>();
const last = (spy: Mock<(choice: AvatarChoice | null) => void>) => spy.mock.calls.at(-1)?.[0];

describe("AvatarPicker", () => {
  // The browser keeps a picked file as an object URL; the test environment has none.
  const created = vi.fn(() => "blob:team-photo");
  const revoked = vi.fn();
  beforeEach(() => {
    Object.assign(URL, { createObjectURL: created, revokeObjectURL: revoked });
  });
  afterEach(() => {
    created.mockClear();
    revoked.mockClear();
  });

  it("opens on the avatar for a team without one, drawn from its name", async () => {
    const onChoiceChange = choiceSpy();
    render(<AvatarPicker seed="Team Anakin" onChoiceChange={onChoiceChange} />);
    expect(screen.getByRole("radio", { name: "Avatar" })).toBeChecked();
    expect(await screen.findByRole("img", { name: "Your avatar" })).toBeInTheDocument();
    expect(last(onChoiceChange)).toEqual({ kind: "avatar", url: "https://api.dicebear.com/10.x/thumbs/svg?seed=Team%20Anakin" });
  });

  it("opens on Upload Photo when the team has its own photo, with nothing picked yet", () => {
    const onChoiceChange = choiceSpy();
    render(<AvatarPicker seed="Team Anakin" current="https://res.cloudinary.com/demo/team.webp" onChoiceChange={onChoiceChange} />);
    expect(screen.getByRole("radio", { name: "Upload Photo" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Choose a photo" })).toBeInTheDocument();
    expect(last(onChoiceChange)).toBeNull();
  });

  it("cuts a picked photo from the middle, and keeps it while the avatar is looked at", async () => {
    const user = userEvent.setup();
    const onChoiceChange = choiceSpy();
    const { container } = render(<AvatarPicker seed="Team Anakin" onChoiceChange={onChoiceChange} />);
    await user.click(screen.getByRole("radio", { name: "Upload Photo" }));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("no file input");
    await user.upload(input, new File(["photo"], "team.png", { type: "image/png" }));
    expect(screen.getByRole("group", { name: "Your photo" })).toBeInTheDocument();
    expect(last(onChoiceChange)).toEqual({ kind: "photo", src: "blob:team-photo", crop: { x: 0, y: 0, zoom: 1, rotation: 0 } });
    await user.click(screen.getByRole("radio", { name: "Avatar" }));
    expect(last(onChoiceChange)?.kind).toBe("avatar");
    await user.click(screen.getByRole("radio", { name: "Upload Photo" }));
    expect(last(onChoiceChange)?.kind).toBe("photo");
    expect(revoked).not.toHaveBeenCalled();
  });

  it("says so when the file is not a photo", async () => {
    const user = userEvent.setup({ applyAccept: false });
    const { container } = render(<AvatarPicker seed="Team Anakin" />);
    await user.click(screen.getByRole("radio", { name: "Upload Photo" }));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("no file input");
    await user.upload(input, new File(["notes"], "notes.txt", { type: "text/plain" }));
    expect(screen.getByText("This file can't be opened as a photo. Try a JPG or PNG.")).toBeInTheDocument();
    expect(created).not.toHaveBeenCalled();
  });

  it("lets the picked photo go when it is replaced", async () => {
    const user = userEvent.setup();
    const { container, unmount } = render(<AvatarPicker seed="Team Anakin" />);
    await user.click(screen.getByRole("radio", { name: "Upload Photo" }));
    const input = container.querySelector<HTMLInputElement>('input[type="file"]');
    if (!input) throw new Error("no file input");
    await user.upload(input, new File(["one"], "one.png", { type: "image/png" }));
    created.mockReturnValueOnce("blob:second");
    await user.upload(input, new File(["two"], "two.png", { type: "image/png" }));
    expect(revoked).toHaveBeenCalledWith("blob:team-photo");
    unmount();
    expect(revoked).toHaveBeenCalledWith("blob:second");
  });
});
