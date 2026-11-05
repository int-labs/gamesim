/** A chart shape, made safe to store. Sanitised at the console boundary, never at render. */

/** Removed with their subtrees. `foreignObject` is the SVG-specific one: it
 *  reopens arbitrary HTML inside an otherwise safe drawing. */
const BLOCKED_TAGS = new Set([
  "script", "object", "embed", "link", "iframe", "foreignobject", "base", "meta",
]);

/** Attributes that name a target. Kept ONLY when the value is a `#fragment`. */
const REF_ATTRS = [
  "href", "xlink:href", "src", "srcset", "action", "formaction",
  "poster", "background", "from", "to", "values",
];

const isInternalRef = (value: string): boolean => value.trim().startsWith("#");

/** `url(#grad)` is a gradient; `url(https://…)` is a fetch. Allow only the
 *  first, and reject the legacy IE `expression(` outright. */
const styleIsSafe = (value: string): boolean => {
  const v = value.toLowerCase();
  if (v.includes("expression(")) return false;
  if (!v.includes("url(")) return true;
  return !/url\(\s*['"]?(?!#)/.test(v);
};

export function sanitizeChartShape(source: string): string {
  if (!source.trim()) return "";

  const doc = new DOMParser().parseFromString(source, "text/html");

  // Checked before any editing, so the decision is made on the document as
  // written rather than on a half-repaired one.
  if (doc.querySelector("script")) {
    const escaper = doc.createElement("textarea");
    escaper.textContent = source;
    return escaper.innerHTML;
  }

  for (const el of Array.from(doc.body.querySelectorAll("*"))) {
    if (BLOCKED_TAGS.has(el.tagName.toLowerCase())) {
      el.remove();
      continue;
    }
    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();

      // Every `on*` handler, without exception.
      if (name.startsWith("on")) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (REF_ATTRS.includes(name) && !isInternalRef(attr.value)) {
        el.removeAttribute(attr.name);
        continue;
      }
      if (name === "style" && !styleIsSafe(attr.value)) {
        el.removeAttribute(attr.name);
      }
    }
  }

  return doc.body.innerHTML;
}
