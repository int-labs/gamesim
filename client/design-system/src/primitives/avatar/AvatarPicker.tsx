import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { ImageUp, Upload } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { Icon } from "../../foundations/icon/Icon";
import { tv } from "../../lib/tv";
import { Alert } from "../alert/Alert";
import { Button } from "../button/Button";
import { AvatarBuilder, type AvatarBuilderMessages } from "./AvatarBuilder";
import { avatarUrl, defaultAvatarStyle, parseAvatarUrl } from "./dicebear";
import { PhotoCropPreview, PhotoCropper, type PhotoCropperMessages } from "./PhotoCropper";
import { cropPhoto, initialPhotoCrop, loadPhoto, type CropPhotoOptions, type PhotoCrop } from "./photoCrop";

/** What the team chose: an avatar drawn from DiceBear, or its own photo and how to cut it. */
export type AvatarChoice = { kind: "avatar"; url: string } | { kind: "photo"; src: string; crop: PhotoCrop };

export interface AvatarPickerMessages {
  /** Names the choice between an avatar and a photo. */
  source: string;
  avatar: string;
  photo: string;
  /** In the empty drop area. */
  drop: string;
  choose: string;
  hint: string;
  another: string;
  /** Over the crop as the avatar will look. */
  preview: string;
  /** Over the crop on a team card, beside the team's name. */
  teamCard: string;
  /** The file is not a photo this browser can open. */
  unreadable: string;
}

const defaultMessages: AvatarPickerMessages = {
  source: "Profile photo",
  avatar: "Avatar",
  photo: "Upload Photo",
  drop: "Drop your team's photo here",
  choose: "Choose a photo",
  hint: "Any photo or picture. You choose what shows in the circle.",
  another: "Choose another photo",
  preview: "Preview",
  teamCard: "On the team card",
  unreadable: "This file can't be opened as a photo. Try a JPG or PNG.",
};

/**
 * A team's avatar, two ways: an avatar built from DiceBear part by part (AvatarBuilder), or the
 * team's own photo, picked or dropped, then moved, zoomed and turned into the circle
 * (PhotoCropper). The choice goes to the page as it changes; photoOf draws a photo's crop for the
 * upload, and an avatar is saved as its address.
 */
export const avatarPickerVariants = tv({
  slots: {
    root: "flex flex-col gap-5",
    sources: "inline-flex self-start rounded-xl bg-surface-panel p-1",
    sourceItem: [
      "cursor-pointer rounded-lg px-4 py-2 type-label font-semibold text-fg-muted transition-colors duration-fast ease-standard",
      "outline-offset-2 hover:text-fg-body focus-visible:outline-2 focus-visible:outline-focus-ring",
      "data-checked:bg-surface-card data-checked:text-fg-primary data-checked:shadow-xs",
    ],
    drop: [
      "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-line-strong bg-surface-panel px-6 py-10 text-center",
      "transition-colors duration-fast ease-standard data-over:border-accent data-over:bg-surface-selected",
    ],
    dropIcon: "text-fg-subtle",
    dropText: "type-body font-semibold text-fg-body",
    hint: "type-caption text-fg-muted",
    photo: "flex flex-col items-center gap-3",
    // The cropper, and beside it (under it on a phone) the avatar as it will look.
    cropping: "flex w-full flex-col items-center gap-8 sm:flex-row sm:items-start sm:justify-center sm:gap-12",
    previews: "flex flex-col items-center gap-4 sm:pt-2",
    previewLabel: "type-label font-semibold text-fg-primary",
    teamCard: "flex items-center gap-3 rounded-xl bg-surface-card py-2 pr-4 pl-2 shadow-card inset-ring inset-ring-line-subtle",
    teamName: "type-label font-semibold text-fg-primary",
    teamCardLabel: "type-caption text-fg-muted",
  },
});

export interface AvatarPickerProps {
  /** What a new avatar starts from: the team's name. */
  seed: string;
  /** The team's avatar now: a DiceBear address opens the builder on it; a photo opens on Upload Photo. */
  current?: string | null;
  /** Each change: the avatar's address, or a photo and its crop (null until a photo is picked). */
  onChoiceChange?: (choice: AvatarChoice | null) => void;
  /** Takes the focus on arrival (the choice between avatar and photo), as in a dialog's second view. */
  autoFocus?: boolean;
  messages?: Partial<AvatarPickerMessages>;
  builderMessages?: Partial<AvatarBuilderMessages>;
  cropperMessages?: Partial<PhotoCropperMessages>;
  className?: string;
}

type Source = "avatar" | "photo";

/** The team's avatar: built from DiceBear, or its own photo cut to the circle. */
export function AvatarPicker({
  seed,
  current,
  onChoiceChange,
  autoFocus = false,
  messages,
  builderMessages,
  cropperMessages,
  className,
}: AvatarPickerProps) {
  const text = { ...defaultMessages, ...messages };
  const slots = avatarPickerVariants();
  const drawn = parseAvatarUrl(current) !== null;
  const [source, setSource] = useState<Source>(current && !drawn ? "photo" : "avatar");
  const [avatar, setAvatar] = useState(() => (drawn && current ? current : avatarUrl({ style: defaultAvatarStyle, seed, choices: {} })));
  const [photo, setPhoto] = useState<{ src: string; crop: PhotoCrop } | null>(null);
  const [unreadable, setUnreadable] = useState(false);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLButtonElement>(null);
  const photoRef = useRef<HTMLButtonElement>(null);

  // On arrival only: the choice the picker opened on.
  useEffect(() => {
    if (autoFocus) (source === "avatar" ? avatarRef : photoRef).current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The page learns the choice as it stands, the first one too.
  const choice: AvatarChoice | null = source === "avatar" ? { kind: "avatar", url: avatar } : photo ? { kind: "photo", ...photo } : null;
  const report = useRef(onChoiceChange);
  useEffect(() => {
    report.current = onChoiceChange;
  });
  const key = choice ? JSON.stringify(choice) : "";
  // Only when the choice itself changes, not each time the page draws the picker again.
  useEffect(() => report.current?.(choice), [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // A picked file lives as an object URL while it is shown.
  useEffect(() => {
    const src = photo?.src;
    return () => {
      if (src) URL.revokeObjectURL(src);
    };
  }, [photo?.src]);

  const take = (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUnreadable(true);
      return;
    }
    setUnreadable(false);
    setPhoto({ src: URL.createObjectURL(file), crop: initialPhotoCrop });
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setOver(false);
    take(event.dataTransfer.files[0]);
  };

  return (
    <div className={slots.root({ className })}>
      <RadioGroup aria-label={text.source} value={source} onValueChange={(next) => setSource(next)} className={slots.sources()}>
        <Radio.Root ref={avatarRef} value="avatar" className={slots.sourceItem()}>
          {text.avatar}
        </Radio.Root>
        <Radio.Root ref={photoRef} value="photo" className={slots.sourceItem()}>
          {text.photo}
        </Radio.Root>
      </RadioGroup>
      {source === "avatar" ? (
        <AvatarBuilder seed={seed} value={avatar} onValueChange={setAvatar} messages={builderMessages} />
      ) : (
        <div className={slots.photo()}>
          {unreadable ? <Alert tone="danger">{text.unreadable}</Alert> : null}
          {photo ? (
            <div className={slots.cropping()}>
              <div className={slots.photo()}>
                <PhotoCropper
                  src={photo.src}
                  value={photo.crop}
                  onValueChange={(crop) => setPhoto({ src: photo.src, crop })}
                  onError={() => {
                    setPhoto(null);
                    setUnreadable(true);
                  }}
                  messages={cropperMessages}
                />
                <Button variant="text" iconStart={Upload} onClick={() => inputRef.current?.click()}>
                  {text.another}
                </Button>
              </div>
              <div className={slots.previews()}>
                <span className={slots.previewLabel()}>{text.preview}</span>
                <PhotoCropPreview src={photo.src} crop={photo.crop} size="lg" />
                <span className={slots.teamCardLabel()}>{text.teamCard}</span>
                <div className={slots.teamCard()}>
                  <PhotoCropPreview src={photo.src} crop={photo.crop} size="sm" />
                  <span className={slots.teamName()}>{seed}</span>
                </div>
              </div>
            </div>
          ) : (
            <div
              className={slots.drop()}
              data-over={over || undefined}
              onDragOver={(event) => {
                event.preventDefault();
                setOver(true);
              }}
              onDragLeave={() => setOver(false)}
              onDrop={onDrop}
            >
              <Icon icon={ImageUp} size="xl" className={slots.dropIcon()} />
              <p className={slots.dropText()}>{text.drop}</p>
              <Button variant="outline" size="md" iconStart={Upload} onClick={() => inputRef.current?.click()}>
                {text.choose}
              </Button>
              <p className={slots.hint()}>{text.hint}</p>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              take(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * The picture to upload for a choice: a photo's crop, drawn as a square (cropPhoto); an avatar is
 * kept as its address, so it has none.
 */
export async function photoOf(choice: AvatarChoice, options?: CropPhotoOptions): Promise<Blob | null> {
  if (choice.kind !== "photo") return null;
  return cropPhoto(await loadPhoto(choice.src), choice.crop, options);
}
