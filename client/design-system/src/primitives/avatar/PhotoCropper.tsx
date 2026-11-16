import { Slider as BaseSlider } from "@base-ui/react/slider";
import { RotateCw, ZoomIn, ZoomOut } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { tv } from "../../lib/tv";
import { IconButton } from "../icon-button/IconButton";
import { sliderVariants } from "../slider/Slider";
import {
  clampPhotoCrop,
  defaultMaxZoom,
  initialPhotoCrop,
  movePhotoCrop,
  photoCropStyle,
  turnPhotoCrop,
  zoomPhotoCrop,
  type PhotoCrop,
} from "./photoCrop";

export interface PhotoCropperMessages {
  /** Names the photo, which moves with the pointer and the arrow keys. */
  photo: string;
  /** How to move and zoom it, shown under the controls. */
  instructions: string;
  zoom: string;
  zoomIn: string;
  zoomOut: string;
  /** Turns the photo a quarter turn clockwise. */
  rotate: string;
  /** How screen readers say the zoom ("150%"). */
  zoomValue: (percent: number) => string;
}

const defaultMessages: PhotoCropperMessages = {
  photo: "Your photo",
  instructions: "Drag the photo, or use the arrow keys, to choose what shows in the circle.",
  zoom: "Zoom",
  zoomIn: "Zoom in",
  zoomOut: "Zoom out",
  rotate: "Turn",
  zoomValue: (percent) => `${percent}%`,
};

/**
 * A team's own photo cut to its round avatar: the photo in a square, the circle that will be kept
 * marked out and the rest dimmed, and under it the zoom and a quarter turn. The photo moves under
 * the pointer (a finger, or two to zoom), the arrow keys and the wheel; the circle is always
 * covered. The value is the crop (photoCrop.ts); cropPhoto draws it for the upload.
 */
export const photoCropperVariants = tv({
  slots: {
    root: "flex w-full max-w-72 flex-col items-center gap-3",
    viewport: [
      "relative aspect-square w-full touch-none overflow-hidden rounded-2xl bg-surface-panel select-none",
      "cursor-grab data-dragging:cursor-grabbing",
      "outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus-ring",
    ],
    // The circle's box: the photo is laid out against it, and may reach past it.
    frame: "absolute inset-4",
    // No will-change: a zoomed photo is drawn again at its new size, sharp.
    photo: "absolute top-1/2 left-1/2 max-w-none photo-crop",
    mask: "pointer-events-none absolute inset-4 rounded-full photo-crop-mask inset-ring-2 inset-ring-surface-card/80",
    controls: "flex w-full items-center gap-2",
    zoom: "min-w-0 flex-1",
    instructions: "text-center type-caption text-fg-muted",
  },
  variants: {
    /** The photo's shorter side spans the circle at zoom 1. */
    orientation: {
      landscape: { photo: "h-full w-auto" },
      portrait: { photo: "h-auto w-full" },
    },
  },
  defaultVariants: { orientation: "landscape" },
});

export interface PhotoCropperProps {
  /** The photo: a picked file's object URL, or an address the canvas may read. */
  src: string;
  /** The crop, when the page keeps it. */
  value?: PhotoCrop;
  /** The crop at first, when the cropper keeps its own. Default centred, zoom 1, not turned. */
  defaultValue?: PhotoCrop;
  onValueChange?: (crop: PhotoCrop) => void;
  /** Default 4: a quarter of the photo's shorter side across the circle. */
  maxZoom?: number;
  /** The photo could not be opened (not an image this browser reads). */
  onError?: () => void;
  messages?: Partial<PhotoCropperMessages>;
  className?: string;
}

/** A step of the arrow keys, as a share of the circle; Shift takes bigger ones. */
const keyStep = 0.02;
const bigKeyStep = 0.1;
/** A press of Zoom in or out, and of + or -. */
const zoomStep = 0.25;

interface Gesture {
  /** Where each finger or the pointer is now. */
  pointers: Map<number, { x: number; y: number }>;
  /** The crop, the pointers and their spread when the gesture (re)started. */
  crop: PhotoCrop;
  start: Map<number, { x: number; y: number }>;
  spread: number;
  /** The circle's width in pixels. */
  circle: number;
}

const spreadOf = (points: Map<number, { x: number; y: number }>) => {
  const [a, b] = [...points.values()];
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
};

/** A team's photo, moved, zoomed and turned into its round avatar. */
export function PhotoCropper({
  src,
  value,
  defaultValue,
  onValueChange,
  maxZoom = defaultMaxZoom,
  onError,
  messages,
  className,
}: PhotoCropperProps) {
  const text = { ...defaultMessages, ...messages };
  const instructionsId = useId();
  const [own, setOwn] = useState<PhotoCrop>(defaultValue ?? initialPhotoCrop);
  // The photo's size once it has loaded; a new photo waits for its own.
  const [loaded, setLoaded] = useState<{ src: string; width: number; height: number } | null>(null);
  const size = loaded?.src === src ? loaded : null;
  const [dragging, setDragging] = useState(false);
  const viewportRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<Gesture | null>(null);

  const raw = value ?? own;
  const crop = size ? clampPhotoCrop(size.width, size.height, raw, maxZoom) : raw;
  // The wheel's listener and the gestures are the page's own events: they read the crop from here.
  const latest = useRef({ crop, size });
  useLayoutEffect(() => {
    latest.current = { crop, size };
  });

  const change = useCallback(
    (next: PhotoCrop) => {
      if (value === undefined) setOwn(next);
      onValueChange?.(next);
    },
    [value, onValueChange],
  );

  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;
    const onWheel = (event: WheelEvent) => {
      const { crop: now, size: photo } = latest.current;
      if (!photo) return;
      event.preventDefault();
      // A pinch on a trackpad arrives as a wheel with Ctrl, in smaller steps.
      const factor = Math.exp(-event.deltaY * (event.ctrlKey ? 0.01 : 0.002));
      change(zoomPhotoCrop(photo.width, photo.height, now, now.zoom * factor, maxZoom));
    };
    viewport.addEventListener("wheel", onWheel, { passive: false });
    return () => viewport.removeEventListener("wheel", onWheel);
  }, [change, maxZoom]);

  /** (Re)starts the gesture from the crop as it is, with the pointers now down. */
  const restart = (gesture: Gesture) => {
    gesture.crop = latest.current.crop;
    gesture.start = new Map(gesture.pointers);
    gesture.spread = spreadOf(gesture.pointers);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!size || (event.pointerType === "mouse" && event.button !== 0)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const gesture = gestureRef.current ?? {
      pointers: new Map(),
      crop,
      start: new Map(),
      spread: 0,
      circle: frameRef.current?.getBoundingClientRect().width || 1,
    };
    gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    restart(gesture);
    gestureRef.current = gesture;
    setDragging(true);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture || !size || !gesture.pointers.has(event.pointerId)) return;
    gesture.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (gesture.pointers.size >= 2 && gesture.spread > 0) {
      change(zoomPhotoCrop(size.width, size.height, gesture.crop, gesture.crop.zoom * (spreadOf(gesture.pointers) / gesture.spread), maxZoom));
      return;
    }
    const from = gesture.start.get(event.pointerId);
    if (!from) return;
    const dx = (event.clientX - from.x) / gesture.circle;
    const dy = (event.clientY - from.y) / gesture.circle;
    change(movePhotoCrop(size.width, size.height, gesture.crop, dx, dy, maxZoom));
  };

  const onPointerEnd = (event: PointerEvent<HTMLDivElement>) => {
    const gesture = gestureRef.current;
    if (!gesture) return;
    gesture.pointers.delete(event.pointerId);
    if (gesture.pointers.size === 0) {
      gestureRef.current = null;
      setDragging(false);
    } else {
      // The finger left behind carries on moving the photo from where it is.
      restart(gesture);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!size) return;
    const step = event.shiftKey ? bigKeyStep : keyStep;
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-step, 0],
      ArrowRight: [step, 0],
      ArrowUp: [0, -step],
      ArrowDown: [0, step],
    };
    const move = moves[event.key];
    if (move) {
      event.preventDefault();
      change(movePhotoCrop(size.width, size.height, crop, move[0], move[1], maxZoom));
    } else if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      change(zoomPhotoCrop(size.width, size.height, crop, crop.zoom + zoomStep, maxZoom));
    } else if (event.key === "-" || event.key === "_") {
      event.preventDefault();
      change(zoomPhotoCrop(size.width, size.height, crop, crop.zoom - zoomStep, maxZoom));
    }
  };

  const zoomTo = (zoom: number) => size && change(zoomPhotoCrop(size.width, size.height, crop, zoom, maxZoom));

  const slots = photoCropperVariants({ orientation: size && size.height > size.width ? "portrait" : "landscape" });
  const slider = sliderVariants({ marks: "numbers" });
  const share = (crop.zoom - 1) / Math.max(maxZoom - 1, Number.EPSILON);
  const ready = size !== null;

  return (
    <div className={slots.root({ className })}>
      <div
        ref={viewportRef}
        role="group"
        aria-label={text.photo}
        aria-describedby={instructionsId}
        tabIndex={0}
        data-dragging={dragging || undefined}
        className={slots.viewport()}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onKeyDown={onKeyDown}
      >
        <div ref={frameRef} className={slots.frame()}>
          <img
            key={src}
            src={src}
            alt=""
            draggable={false}
            className={slots.photo()}
            style={size ? (photoCropStyle(size.width, size.height, crop) as CSSProperties) : { visibility: "hidden" }}
            onLoad={(event) => setLoaded({ src, width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
            onError={() => onError?.()}
          />
        </div>
        <div className={slots.mask()} />
      </div>
      <div className={slots.controls()}>
        <IconButton icon={ZoomOut} label={text.zoomOut} disabled={!ready || crop.zoom <= 1} onClick={() => zoomTo(crop.zoom - zoomStep)} />
        <BaseSlider.Root
          value={crop.zoom}
          min={1}
          max={maxZoom}
          step={0.01}
          disabled={!ready}
          onValueChange={(zoom) => zoomTo(zoom)}
          className={slots.zoom()}
          style={{ "--slider-fill-start": 0, "--slider-fill-end": share } as CSSProperties}
        >
          <BaseSlider.Control className={slider.control()}>
            <div className={slider.rail()}>
              <div className={slider.fill()} data-from-start data-to-end={share >= 1 || undefined} />
            </div>
            <BaseSlider.Track className={slider.track()}>
              <BaseSlider.Thumb
                aria-label={text.zoom}
                getAriaValueText={(_formatted, zoom) => text.zoomValue(Math.round(zoom * 100))}
                className={slider.thumb()}
              />
            </BaseSlider.Track>
          </BaseSlider.Control>
        </BaseSlider.Root>
        <IconButton icon={ZoomIn} label={text.zoomIn} disabled={!ready || crop.zoom >= maxZoom} onClick={() => zoomTo(crop.zoom + zoomStep)} />
        <IconButton
          icon={RotateCw}
          label={text.rotate}
          disabled={!ready}
          onClick={() => size && change(turnPhotoCrop(size.width, size.height, crop, maxZoom))}
        />
      </div>
      <p id={instructionsId} className={slots.instructions()}>
        {text.instructions}
      </p>
    </div>
  );
}

/** The crop as the avatar will show it: the circle alone, at an avatar's size. */
export const photoCropPreviewVariants = tv({
  slots: {
    root: "relative shrink-0 overflow-hidden rounded-full bg-surface-panel",
    photo: "absolute top-1/2 left-1/2 max-w-none photo-crop",
  },
  variants: {
    /** Large beside the cropper; medium as the dialog's profile photo; small as the team card's. */
    size: {
      sm: { root: "size-(--avatar-size-lg)" },
      md: { root: "size-(--avatar-size-xl)" },
      lg: { root: "size-32" },
    },
    orientation: {
      landscape: { photo: "h-full w-auto" },
      portrait: { photo: "h-auto w-full" },
    },
  },
  defaultVariants: { size: "lg", orientation: "landscape" },
});

export interface PhotoCropPreviewProps {
  src: string;
  crop: PhotoCrop;
  size?: "sm" | "md" | "lg";
  className?: string;
}

/** The crop in its circle, as the saved avatar will look: the cropper's own picture, smaller. */
export function PhotoCropPreview({ src, crop, size, className }: PhotoCropPreviewProps) {
  const [loaded, setLoaded] = useState<{ src: string; width: number; height: number } | null>(null);
  const natural = loaded?.src === src ? loaded : null;
  const slots = photoCropPreviewVariants({ size, orientation: natural && natural.height > natural.width ? "portrait" : "landscape" });
  return (
    <div aria-hidden className={slots.root({ className })}>
      <img
        src={src}
        alt=""
        draggable={false}
        className={slots.photo()}
        style={natural ? (photoCropStyle(natural.width, natural.height, crop) as CSSProperties) : { visibility: "hidden" }}
        onLoad={(event) => setLoaded({ src, width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
      />
    </div>
  );
}
