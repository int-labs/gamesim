/** A page number, or a gap drawn as an ellipsis. */
export type PageItem = number | "gap";

/**
 * The pages to show around the current one, as the Figma pagination does ("1 2 3 ... 10"): the
 * first and last pages, the current page with one on each side, and a gap for every run of
 * hidden pages. A gap never stands in for a single page: that page is shown instead.
 */
export function pageItems(page: number, pageCount: number): PageItem[] {
  if (pageCount <= 0) return [];
  const current = Math.min(Math.max(page, 1), pageCount);
  // Near either end, keep three pages together so the run does not shrink to one.
  const start = Math.max(1, Math.min(current - 1, pageCount - 2));
  const end = Math.min(pageCount, Math.max(current + 1, 3));
  const items: PageItem[] = [];
  const push = (from: number, to: number) => {
    for (let number = from; number <= to; number += 1) items.push(number);
  };
  if (start > 1) {
    items.push(1);
    if (start === 3) items.push(2);
    else if (start > 3) items.push("gap");
  }
  push(start, end);
  if (end < pageCount) {
    if (end === pageCount - 2) items.push(pageCount - 1);
    else if (end < pageCount - 2) items.push("gap");
    items.push(pageCount);
  }
  return items;
}
