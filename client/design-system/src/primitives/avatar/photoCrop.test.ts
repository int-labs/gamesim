import { clampPhotoCrop, initialPhotoCrop, movePhotoCrop, photoCropStyle, turnPhotoCrop, turnedSize, zoomPhotoCrop, type PhotoCrop } from "./photoCrop";

// A landscape photo, twice as wide as it is high: at zoom 1 it spans two circles across, one down.
const wide = { width: 2000, height: 1000 };

describe("cropping a photo to the circle", () => {
  it("starts centred, at zoom 1, not turned", () => {
    expect(initialPhotoCrop).toEqual({ x: 0, y: 0, zoom: 1, rotation: 0 });
  });

  it("swaps the sides on a quarter turn", () => {
    expect(turnedSize(2000, 1000, 90)).toEqual({ width: 1000, height: 2000 });
    expect(turnedSize(2000, 1000, 180)).toEqual({ width: 2000, height: 1000 });
  });

  it("keeps the circle covered: a wide photo moves sideways by half a circle at most, not up or down", () => {
    expect(movePhotoCrop(wide.width, wide.height, initialPhotoCrop, 2, 2)).toEqual({ x: 0.5, y: 0, zoom: 1, rotation: 0 });
    expect(movePhotoCrop(wide.width, wide.height, initialPhotoCrop, -0.2, 0)).toEqual({ x: -0.2, y: 0, zoom: 1, rotation: 0 });
  });

  it("keeps the zoom between 1 and the most allowed", () => {
    expect(clampPhotoCrop(wide.width, wide.height, { ...initialPhotoCrop, zoom: 0.5 }).zoom).toBe(1);
    expect(clampPhotoCrop(wide.width, wide.height, { ...initialPhotoCrop, zoom: 9 }).zoom).toBe(4);
    expect(clampPhotoCrop(wide.width, wide.height, { ...initialPhotoCrop, zoom: 9 }, 6).zoom).toBe(6);
  });

  it("zooms about the circle's centre: what is there stays there", () => {
    const moved = { x: 0.25, y: 0, zoom: 1, rotation: 0 as const };
    expect(zoomPhotoCrop(wide.width, wide.height, moved, 2)).toEqual({ x: 0.5, y: 0, zoom: 2, rotation: 0 });
  });

  it("zooming out pulls the photo back over the circle", () => {
    const zoomed = { x: 1.2, y: 0.4, zoom: 3, rotation: 0 as const };
    const { x, ...rest } = zoomPhotoCrop(wide.width, wide.height, zoomed, 1);
    expect(x).toBeCloseTo(0.4);
    expect(rest).toEqual({ y: 0, zoom: 1, rotation: 0 });
  });

  it("turns a quarter clockwise about the circle's centre, and keeps the circle covered", () => {
    const moved = { x: 0.3, y: 0, zoom: 1, rotation: 0 as const };
    // The photo's centre, right of the circle's, goes below it; the photo now stands tall.
    expect(turnPhotoCrop(wide.width, wide.height, moved)).toEqual({ x: 0, y: 0.3, zoom: 1, rotation: 90 });
    const full = [90, 180, 270, 0].reduce<PhotoCrop>((crop) => turnPhotoCrop(wide.width, wide.height, crop), moved);
    expect(full).toEqual(moved);
  });

  it("moves the photo in shares of its own box, as CSS translate measures them", () => {
    expect(photoCropStyle(wide.width, wide.height, { x: 0.5, y: 0, zoom: 2, rotation: 90 })).toEqual({
      "--photo-x": "25%",
      "--photo-y": "0%",
      "--photo-rotate": "90deg",
      "--photo-zoom": "2",
    });
  });
});
