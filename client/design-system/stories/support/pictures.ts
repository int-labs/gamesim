import { tokens } from "../../src";

const { color } = tokens;

/**
 * A stand-in for a team's DiceBear picture (Figma avatar07), drawn from the tokens as a data URL
 * so the stories need no network.
 */
export function teamPicture(background: string, face: string) {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 46 46">`,
    `<rect width="46" height="46" fill="${background}"/>`,
    `<circle cx="23" cy="27" r="16" fill="${face}"/>`,
    `<circle cx="17" cy="23" r="2" fill="${color.surface.card}"/>`,
    `<circle cx="29" cy="23" r="2" fill="${color.surface.card}"/>`,
    `<path d="M16 30c3 4 11 4 14 0" fill="none" stroke="${color.surface.card}" stroke-width="2.5" stroke-linecap="round"/>`,
    `</svg>`,
  ].join("");
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/**
 * A stand-in for a business unit's own mark (ET Prime's banks carry theirs): a rounded square with
 * a column front, drawn from the tokens as a data URL.
 */
export function unitMark(background: string) {
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">`,
    `<rect width="20" height="20" rx="4" fill="${background}"/>`,
    `<path d="M4 8h12L10 4.5z" fill="${color.surface.card}"/>`,
    `<path d="M5.5 9.5v5M8.5 9.5v5M11.5 9.5v5M14.5 9.5v5" stroke="${color.surface.card}" stroke-width="1.5"/>`,
    `<rect x="4" y="15" width="12" height="1.5" fill="${color.surface.card}"/>`,
    `</svg>`,
  ].join("");
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Team Anakin's picture: indigo on lavender. */
export const anakinPicture = teamPicture(color.surface.expanded, color.accent.DEFAULT);
/** Team Delta's picture: pink on yellow. */
export const deltaPicture = teamPicture(color.energy.DEFAULT, color.primary.DEFAULT);

/**
 * A team's photo for the cropper: a drawn scene (four people on a hill under the sun), not a real
 * person, the same on every run. 1200 by 800, or 800 by 1200 when `portrait`.
 */
export function teamPhoto(portrait = false) {
  const [width, height] = portrait ? [800, 1200] : [1200, 800];
  const people = [color.primary.DEFAULT, color.accent.DEFAULT, color.chart["5"], color.accent.secondary];
  const ground = height * 0.72;
  const figures = people
    .map((body, index) => {
      const x = width / 2 + (index - 1.5) * 130;
      return [
        `<rect x="${x - 45}" y="${ground - 150}" width="90" height="170" rx="45" fill="${body}"/>`,
        `<circle cx="${x}" cy="${ground - 190}" r="38" fill="${color.warning.soft}" stroke="${color.warning["soft-fg"]}" stroke-width="3"/>`,
      ].join("");
    })
    .join("");
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">`,
    `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color.info.soft}"/><stop offset="1" stop-color="${color.surface.card}"/></linearGradient></defs>`,
    `<rect width="${width}" height="${height}" fill="url(#sky)"/>`,
    `<circle cx="${width * 0.8}" cy="${height * 0.2}" r="${Math.min(width, height) * 0.1}" fill="${color.energy.DEFAULT}"/>`,
    `<path d="M0 ${height * 0.62} Q ${width * 0.3} ${height * 0.46} ${width * 0.62} ${height * 0.6} T ${width} ${height * 0.56} V ${height} H 0 Z" fill="${color.success.soft}"/>`,
    figures,
    `<path d="M0 ${ground + 10} Q ${width * 0.45} ${ground - 40} ${width} ${ground + 20} V ${height} H 0 Z" fill="${color.success.DEFAULT}"/>`,
    `</svg>`,
  ].join("");
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** Four colours in four quarters (red, green; blue, yellow): where a crop lands is plain to see and to test. */
export function quartersPhoto(size = 400) {
  const half = size / 2;
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">`,
    `<rect width="${half}" height="${half}" fill="${color.danger.DEFAULT}"/>`,
    `<rect x="${half}" width="${half}" height="${half}" fill="${color.success.DEFAULT}"/>`,
    `<rect y="${half}" width="${half}" height="${half}" fill="${color.info.DEFAULT}"/>`,
    `<rect x="${half}" y="${half}" width="${half}" height="${half}" fill="${color.energy.DEFAULT}"/>`,
    `</svg>`,
  ].join("");
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** A picture as the file a player would pick. */
export async function pictureFile(dataUrl: string, name = "team-photo.svg") {
  const blob = await (await fetch(dataUrl)).blob();
  return new File([blob], name, { type: blob.type || "image/svg+xml" });
}

/** Picks a file in a file input, as the browser does after the player chooses one. */
export function pickFile(input: HTMLInputElement, file: File) {
  const transfer = new DataTransfer();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new Event("change", { bubbles: true }));
}
