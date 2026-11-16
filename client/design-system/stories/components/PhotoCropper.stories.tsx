import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect, useState } from "react";
import { expect, waitFor } from "storybook/test";
import { Card, cropPhoto, loadPhoto, PhotoCropper, Text, tokens, type PhotoCrop } from "../../src";
import { quartersPhoto, teamPhoto } from "../support/pictures";

const meta = {
  title: "Components/Photo cropper",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "A team's own photo cut to its round avatar: the photo in a square with the circle that will be kept marked out and the rest dimmed, then the zoom and a quarter turn. The photo moves under the pointer (a finger, or two to zoom), the arrow keys and the wheel, and the circle is always covered. `cropPhoto` draws the same crop on a canvas: a 512 px square, ready for today's upload.",
      },
    },
  },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

/** Waits for the photo to load, so the screenshot shows it cropped. */
async function loaded(canvasElement: HTMLElement) {
  await waitFor(() => expect(canvasElement.querySelector('img[style*="--photo-zoom"]')).not.toBeNull());
}

function Cropper({ src, initial }: { src: string; initial?: PhotoCrop }) {
  const [crop, setCrop] = useState<PhotoCrop | undefined>(initial);
  return (
    <Card className="max-w-sm items-center">
      <PhotoCropper src={src} value={crop} onValueChange={setCrop} />
    </Card>
  );
}

/** A wide photo at first: centred, its height across the circle. */
export const WidePhoto: Story = {
  render: () => <Cropper src={teamPhoto()} />,
  play: async ({ canvasElement }) => {
    await loaded(canvasElement);
  },
};

/** Zoomed in on two of the team and moved to them. */
export const ZoomedAndMoved: Story = {
  render: () => <Cropper src={teamPhoto()} initial={{ x: 0.35, y: 0.1, zoom: 2.2, rotation: 0 }} />,
  play: async ({ canvasElement }) => {
    await loaded(canvasElement);
  },
};

/** A tall photo, turned a quarter: it lies on its side and its width now spans the circle. */
export const TallPhotoTurned: Story = {
  render: () => <Cropper src={teamPhoto(true)} initial={{ x: 0, y: 0, zoom: 1, rotation: 90 }} />,
  play: async ({ canvasElement }) => {
    await loaded(canvasElement);
  },
};

const crops: { name: string; crop: PhotoCrop }[] = [
  { name: "Top left, zoom 2", crop: { x: 0.5, y: 0.5, zoom: 2, rotation: 0 } },
  { name: "Top right, zoom 2", crop: { x: -0.5, y: 0.5, zoom: 2, rotation: 0 } },
  { name: "Whole, a quarter turn", crop: { x: 0, y: 0, zoom: 1, rotation: 90 } },
];

/** The cropper and the square it saves, side by side, for three crops of four coloured quarters. */
function Saved() {
  const src = quartersPhoto();
  const [saved, setSaved] = useState<string[]>([]);
  useEffect(() => {
    let live = true;
    const urls: string[] = [];
    void loadPhoto(src).then(async (photo) => {
      for (const { crop } of crops) urls.push(URL.createObjectURL(await cropPhoto(photo, crop, { size: 256, type: "image/png" })));
      if (live) setSaved([...urls]);
    });
    return () => {
      live = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [src]);
  return (
    <div className="flex flex-wrap gap-6">
      {crops.map(({ name, crop }, index) => (
        <Card key={name} className="w-72 items-center">
          <Text variant="label">{name}</Text>
          <PhotoCropper src={src} value={crop} />
          {saved[index] ? <img src={saved[index]} alt={`Saved: ${name}`} className="size-32 rounded-full" /> : null}
        </Card>
      ))}
    </div>
  );
}

/** The colour at a point of a saved square. */
function colourAt(image: HTMLImageElement, x: number, y: number) {
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("no canvas");
  context.drawImage(image, 0, 0);
  const [red = 0, green = 0, blue = 0] = context.getImageData(x, y, 1, 1).data;
  return [red, green, blue];
}

const rgb = (hex: string) => [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16));

/** What is saved is what the circle shows: each square is checked where its quarters must fall. */
export const WhatIsSaved: Story = {
  render: () => <Saved />,
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelectorAll('img[alt^="Saved"]')).toHaveLength(3), { timeout: 10_000 });
    const images = [...canvasElement.querySelectorAll<HTMLImageElement>('img[alt^="Saved"]')];
    await Promise.all(images.map((image) => image.decode()));
    const { danger, success, info, energy } = tokens.color;
    const expected: [number, number, number, string][] = [
      [0, 16, 16, danger.DEFAULT],
      [0, 128, 128, danger.DEFAULT],
      [0, 240, 240, danger.DEFAULT],
      [1, 16, 16, success.DEFAULT],
      [1, 240, 240, success.DEFAULT],
      // A quarter turn clockwise: the bottom left comes to the top left, the top left to the top right.
      [2, 64, 64, info.DEFAULT],
      [2, 192, 64, danger.DEFAULT],
      [2, 192, 192, success.DEFAULT],
      [2, 64, 192, energy.DEFAULT],
    ];
    for (const [index, x, y, hex] of expected) {
      const image = images[index];
      if (!image) throw new Error("missing square");
      const actual = colourAt(image, x, y);
      for (const [at, channel] of rgb(hex).entries()) {
        await expect(Math.abs((actual[at] ?? 0) - channel), `${hex} at ${x},${y} of square ${index + 1}`).toBeLessThanOrEqual(6);
      }
    }
  },
};
