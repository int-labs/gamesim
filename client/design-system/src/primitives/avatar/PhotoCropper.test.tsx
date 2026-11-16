import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, type Mock } from "vitest";
import { PhotoCropper } from "./PhotoCropper";
import type { PhotoCrop } from "./photoCrop";

/** The browser would load the photo; here it arrives with the size given. */
function loadPhoto(container: HTMLElement, width: number, height: number) {
  const photo = container.querySelector("img");
  if (!photo) throw new Error("no photo");
  Object.defineProperty(photo, "naturalWidth", { value: width });
  Object.defineProperty(photo, "naturalHeight", { value: height });
  fireEvent.load(photo);
  return photo;
}

const cropSpy = () => vi.fn<(crop: PhotoCrop) => void>();
const last = (spy: Mock<(crop: PhotoCrop) => void>) => spy.mock.calls.at(-1)?.[0];

describe("PhotoCropper", () => {
  it("waits for the photo before its controls answer", () => {
    render(<PhotoCropper src="team.jpg" />);
    expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Turn" })).toBeDisabled();
  });

  it("moves the photo with the arrow keys, and never uncovers the circle", async () => {
    const user = userEvent.setup();
    const onValueChange = cropSpy();
    const { container } = render(<PhotoCropper src="team.jpg" onValueChange={onValueChange} />);
    loadPhoto(container, 2000, 1000);
    screen.getByRole("group", { name: "Your photo" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(last(onValueChange)).toEqual({ x: 0.02, y: 0, zoom: 1, rotation: 0 });
    await user.keyboard("{Shift>}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{ArrowRight}{/Shift}");
    expect(last(onValueChange)).toEqual({ x: 0.5, y: 0, zoom: 1, rotation: 0 });
    // A wide photo at zoom 1 already fills the circle from top to bottom.
    await user.keyboard("{ArrowDown}");
    expect(last(onValueChange)?.y).toBe(0);
  });

  it("zooms with its buttons and with plus and minus, from 1 to 4", async () => {
    const user = userEvent.setup();
    const onValueChange = cropSpy();
    const { container } = render(<PhotoCropper src="team.jpg" onValueChange={onValueChange} />);
    loadPhoto(container, 1200, 1600);
    expect(screen.getByRole("button", { name: "Zoom out" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Zoom in" }));
    expect(last(onValueChange)?.zoom).toBe(1.25);
    expect(screen.getByRole("slider", { name: "Zoom" })).toHaveAttribute("aria-valuetext", "125%");
    screen.getByRole("group", { name: "Your photo" }).focus();
    await user.keyboard("-");
    expect(last(onValueChange)?.zoom).toBe(1);
  });

  it("turns the photo a quarter clockwise", async () => {
    const user = userEvent.setup();
    const onValueChange = cropSpy();
    const { container } = render(<PhotoCropper src="team.jpg" onValueChange={onValueChange} />);
    loadPhoto(container, 2000, 1000);
    await user.click(screen.getByRole("button", { name: "Turn" }));
    expect(last(onValueChange)).toEqual({ x: 0, y: 0, zoom: 1, rotation: 90 });
  });

  it("shows a crop kept by the page, as shares of the photo's box", () => {
    const { container } = render(<PhotoCropper src="team.jpg" value={{ x: 0.5, y: 0, zoom: 2, rotation: 0 }} />);
    const photo = loadPhoto(container, 2000, 1000);
    expect(photo.style.getPropertyValue("--photo-x")).toBe("25%");
    expect(photo.style.getPropertyValue("--photo-zoom")).toBe("2");
  });

  it("says when the photo cannot be opened", () => {
    const onError = vi.fn();
    const { container } = render(<PhotoCropper src="notes.txt" onError={onError} />);
    const photo = container.querySelector("img");
    if (photo) fireEvent.error(photo);
    expect(onError).toHaveBeenCalledOnce();
  });
});
