import { pageItems } from "./pages";

describe("pageItems", () => {
  it("shows the Figma run at the start: 1 2 3 ... 10", () => {
    expect(pageItems(1, 10)).toEqual([1, 2, 3, "gap", 10]);
    expect(pageItems(2, 10)).toEqual([1, 2, 3, "gap", 10]);
  });

  it("keeps the current page between its neighbours in the middle", () => {
    expect(pageItems(5, 10)).toEqual([1, "gap", 4, 5, 6, "gap", 10]);
  });

  it("never hides a single page behind a gap", () => {
    expect(pageItems(4, 10)).toEqual([1, 2, 3, 4, 5, "gap", 10]);
    expect(pageItems(7, 10)).toEqual([1, "gap", 6, 7, 8, 9, 10]);
  });

  it("shows the end run: 1 ... 8 9 10", () => {
    expect(pageItems(10, 10)).toEqual([1, "gap", 8, 9, 10]);
  });

  it("lists every page when there are few", () => {
    expect(pageItems(1, 1)).toEqual([1]);
    expect(pageItems(2, 3)).toEqual([1, 2, 3]);
    expect(pageItems(3, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(pageItems(1, 0)).toEqual([]);
  });

  it("clamps a page outside the range", () => {
    expect(pageItems(0, 10)).toEqual([1, 2, 3, "gap", 10]);
    expect(pageItems(99, 10)).toEqual([1, "gap", 8, 9, 10]);
  });
});
