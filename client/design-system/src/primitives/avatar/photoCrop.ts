/**
 * The maths of cutting a team's photo to its round avatar. The circle is the unit: a crop says
 * where the photo's centre sits from the circle's centre (`x`, `y`, in circle widths), how far it
 * is zoomed (1: its shorter side just fills the circle) and how many quarter turns it has taken.
 * The cropper shows a crop; cropPhoto draws the same crop on a canvas, so what the team sees in
 * the circle is what is saved.
 */

import { tokens } from "../../tokens/generated/tokens";

export type QuarterTurn = 0 | 90 | 180 | 270;

export interface PhotoCrop {
  /** The photo's centre from the circle's centre, in circle widths: right and down are positive. */
  x: number;
  y: number;
  /** 1 fills the circle with the photo's shorter side; more shows less of it. */
  zoom: number;
  /** Quarter turns clockwise. */
  rotation: QuarterTurn;
}

export const initialPhotoCrop: PhotoCrop = { x: 0, y: 0, zoom: 1, rotation: 0 };

/** How far a photo can be zoomed by default: a quarter of its shorter side across the circle. */
export const defaultMaxZoom = 4;

const clamp = (value: number, low: number, high: number) => Math.min(Math.max(value, low), high);

/** The photo's width and height once turned: a quarter turn swaps them. */
export function turnedSize(width: number, height: number, rotation: QuarterTurn) {
  return rotation % 180 === 0 ? { width, height } : { width: height, height: width };
}

/**
 * The same crop with the circle kept covered: the zoom within 1 and `maxZoom`, and the photo's
 * edges never inside the circle.
 */
export function clampPhotoCrop(width: number, height: number, crop: PhotoCrop, maxZoom = defaultMaxZoom): PhotoCrop {
  const zoom = clamp(crop.zoom, 1, Math.max(maxZoom, 1));
  const turned = turnedSize(width, height, crop.rotation);
  const shorter = Math.min(turned.width, turned.height);
  // The photo across the circle, in circle widths, less the circle: how far it can move each way.
  const spareX = Math.max((turned.width / shorter) * zoom - 1, 0) / 2;
  const spareY = Math.max((turned.height / shorter) * zoom - 1, 0) / 2;
  return { rotation: crop.rotation, zoom, x: clamp(crop.x, -spareX, spareX) || 0, y: clamp(crop.y, -spareY, spareY) || 0 };
}

/** Moves the photo by a share of the circle's width. */
export function movePhotoCrop(width: number, height: number, crop: PhotoCrop, dx: number, dy: number, maxZoom = defaultMaxZoom) {
  return clampPhotoCrop(width, height, { ...crop, x: crop.x + dx, y: crop.y + dy }, maxZoom);
}

/** Zooms to `zoom`, keeping what is at the circle's centre there. */
export function zoomPhotoCrop(width: number, height: number, crop: PhotoCrop, zoom: number, maxZoom = defaultMaxZoom) {
  const kept = clamp(zoom, 1, Math.max(maxZoom, 1));
  const factor = kept / crop.zoom;
  return clampPhotoCrop(width, height, { ...crop, zoom: kept, x: crop.x * factor, y: crop.y * factor }, maxZoom);
}

/** A quarter turn clockwise, keeping what is at the circle's centre there. */
export function turnPhotoCrop(width: number, height: number, crop: PhotoCrop, maxZoom = defaultMaxZoom) {
  const rotation = ((crop.rotation + 90) % 360) as QuarterTurn;
  // The photo turns about its own centre, so its centre turns about the circle's: (x, y) to (-y, x).
  return clampPhotoCrop(width, height, { zoom: crop.zoom, rotation, x: -crop.y, y: crop.x }, maxZoom);
}

/**
 * The CSS that shows a crop on a photo laid out with its shorter side across the circle: the move
 * as shares of the photo's own box (what translate's percentages measure), the turn, the zoom.
 */
export function photoCropStyle(width: number, height: number, crop: PhotoCrop) {
  const shorter = Math.min(width, height);
  return {
    "--photo-x": `${(crop.x * shorter * 100) / width}%`,
    "--photo-y": `${(crop.y * shorter * 100) / height}%`,
    "--photo-rotate": `${crop.rotation}deg`,
    "--photo-zoom": String(crop.zoom),
  };
}

/** A photo, loaded and decoded, to draw: from an address (a picked file's object URL). */
export function loadPhoto(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The photo could not be opened."));
    image.src = src;
  });
}

export interface CropPhotoOptions {
  /** The saved square's side in pixels. Default 512: sharp in the largest avatar on a dense screen. */
  size?: number;
  /** Default JPEG, which every browser writes and the upload takes. */
  type?: "image/jpeg" | "image/png" | "image/webp";
  /** Default 0.9. */
  quality?: number;
  /** What shows through a transparent photo (a logo), as JPEG has none. Default the card's white. */
  background?: string;
}

/** The crop drawn as a square picture, the circle's square, ready to upload. */
export function cropPhoto(photo: HTMLImageElement, crop: PhotoCrop, options: CropPhotoOptions = {}): Promise<Blob> {
  const { size = 512, type = "image/jpeg", quality = 0.9, background = tokens.color.surface.card } = options;
  const width = photo.naturalWidth;
  const height = photo.naturalHeight;
  const kept = clampPhotoCrop(width, height, crop, Number.POSITIVE_INFINITY);
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context || width === 0 || height === 0) return Promise.reject(new Error("The photo could not be drawn."));
  context.fillStyle = background;
  context.fillRect(0, 0, size, size);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  // As the cropper's CSS: to the circle's centre, moved, turned, and scaled so the shorter side
  // spans the circle at zoom 1.
  const scale = (kept.zoom * size) / Math.min(width, height);
  context.translate(size / 2 + kept.x * size, size / 2 + kept.y * size);
  context.rotate((kept.rotation * Math.PI) / 180);
  context.scale(scale, scale);
  context.drawImage(photo, -width / 2, -height / 2);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("The photo could not be saved."))), type, quality);
  });
}
