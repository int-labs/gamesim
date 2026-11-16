import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { tv } from "../../lib/tv";
import { dialogVariants } from "../../overlays/dialog/Dialog";
import { Alert } from "../../primitives/alert/Alert";
import { Avatar } from "../../primitives/avatar/Avatar";
import type { AvatarBuilderMessages } from "../../primitives/avatar/AvatarBuilder";
import { AvatarPicker, photoOf, type AvatarChoice, type AvatarPickerMessages } from "../../primitives/avatar/AvatarPicker";
import { avatarUrl, defaultAvatarStyle } from "../../primitives/avatar/dicebear";
import type { PhotoCropperMessages } from "../../primitives/avatar/PhotoCropper";
import { Button, type ButtonStatus } from "../../primitives/button/Button";
import { TextField } from "../../primitives/text-field/TextField";

/** What becomes of the team's avatar on Save. */
export type TeamAvatarChange =
  /** As it is. */
  | { kind: "keep" }
  /** A DiceBear avatar: saved as its address. */
  | { kind: "avatar"; url: string }
  /** The team's photo, cut to the circle: the page uploads it and saves the address it gets. */
  | { kind: "photo"; image: Blob };

export interface TeamDetails {
  teamName: string;
  teamLeader: string;
  avatar: TeamAvatarChange;
}

export interface TeamDialogMessages {
  title: string;
  description: string;
  profilePhoto: string;
  changePhoto: string;
  deletePhoto: string;
  teamName: string;
  teamLeader: string;
  nameRequired: string;
  leaderRequired: string;
  cancel: string;
  save: string;
  photoTitle: string;
  photoDescription: string;
  back: string;
  useAvatar: string;
  usePhoto: string;
  /** The picked photo could not be cut (the browser could not draw it). */
  photoFailed: string;
}

// Figma 2110:245745 and the flow around it (2110:231129).
const defaultMessages: TeamDialogMessages = {
  title: "Edit Team Details",
  description: "You can update the team details. These changes will be reflected across the simulation interface.",
  profilePhoto: "Profile Photo",
  changePhoto: "Change Photo",
  deletePhoto: "Delete",
  teamName: "Team Name",
  teamLeader: "Team Leader",
  nameRequired: "Team Name cannot be empty",
  leaderRequired: "Team Leader cannot be empty",
  cancel: "Cancel",
  save: "Save",
  photoTitle: "Change Photo",
  photoDescription: "Build your team's avatar, or upload your own photo.",
  back: "Back",
  useAvatar: "Use Avatar",
  usePhoto: "Use Photo",
  photoFailed: "This photo could not be prepared. Try another one.",
};

/**
 * The player's Edit Team Details dialog (Figma 2110:245745): the profile photo with Change Photo
 * and Delete, the team's name and leader, Cancel and Save. Change Photo opens the photo's own
 * view: an avatar built from DiceBear, or the team's photo cut to the circle (AvatarPicker). Delete
 * draws a new DiceBear avatar, as Figma's note asks. Save hands the page the details, a photo to
 * upload included; the page saves them and shows the toast.
 */
export const teamDialogVariants = tv({
  slots: {
    fields: "flex flex-col gap-4",
    photoRow: "flex flex-col gap-3",
    photoLabel: "type-label font-semibold text-fg-primary",
    photoActions: "flex flex-wrap items-center gap-4",
    photoButtons: "flex flex-wrap items-center gap-2.5",
  },
});

export interface TeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The team as it is: the dialog opens on it each time. */
  team: { name: string; leader: string; avatarUrl?: string | null };
  /**
   * Saves the details: upload a photo first, then save the team. The dialog closes when it resolves;
   * if it throws, the dialog stays open and `error` says why.
   */
  onSave: (details: TeamDetails) => Promise<void>;
  /** Why the last Save failed (a name another team has), above the actions. */
  error?: ReactNode;
  messages?: Partial<TeamDialogMessages>;
  pickerMessages?: Partial<AvatarPickerMessages>;
  builderMessages?: Partial<AvatarBuilderMessages>;
  cropperMessages?: Partial<PhotoCropperMessages>;
}

/** Edit Team Details: the team's photo or avatar, name and leader. */
export function TeamDialog({ open, onOpenChange, ...body }: TeamDialogProps) {
  // While Save runs, the dialog stays open: the result decides.
  const [busy, setBusy] = useState(false);
  // The photo's view needs the wide modal; each opening starts on the details.
  const [wide, setWide] = useState(false);
  if (!open && wide) setWide(false);
  // The team's name takes the focus: Figma's flow starts by changing it.
  const nameRef = useRef<HTMLInputElement>(null);
  const dialog = dialogVariants({ size: wide ? "lg" : "md" });
  return (
    <BaseDialog.Root
      open={open}
      onOpenChange={(next) => {
        if (next || !busy) onOpenChange(next);
      }}
    >
      <BaseDialog.Portal data-ds-root="">
        <BaseDialog.Backdrop className={dialog.backdrop()} />
        <BaseDialog.Viewport className={dialog.viewport()}>
          <BaseDialog.Popup className={dialog.popup()} initialFocus={nameRef}>
            {/* The popup's content mounts with each opening, so the form starts from the team as it is. */}
            <TeamDialogBody
              {...body}
              nameRef={nameRef}
              onBusyChange={setBusy}
              onViewChange={(view) => setWide(view === "photo")}
              onDone={() => onOpenChange(false)}
            />
          </BaseDialog.Popup>
        </BaseDialog.Viewport>
      </BaseDialog.Portal>
    </BaseDialog.Root>
  );
}

type Pending = { kind: "keep" } | { kind: "avatar"; url: string } | { kind: "photo"; image: Blob; preview: string };

const randomSeed = () => Math.random().toString(36).slice(2, 10);

interface TeamDialogBodyProps extends Omit<TeamDialogProps, "open" | "onOpenChange"> {
  nameRef: RefObject<HTMLInputElement>;
  onBusyChange: (busy: boolean) => void;
  onViewChange: (view: "details" | "photo") => void;
  onDone: () => void;
}

function TeamDialogBody({
  team,
  onSave,
  error,
  messages,
  pickerMessages,
  builderMessages,
  cropperMessages,
  nameRef,
  onBusyChange,
  onViewChange,
  onDone,
}: TeamDialogBodyProps) {
  const text = { ...defaultMessages, ...messages };
  const slots = teamDialogVariants();
  const dialog = dialogVariants();
  const [view, setView] = useState<"details" | "photo">("details");
  const [name, setName] = useState(team.name);
  const [leader, setLeader] = useState(team.leader);
  const [pending, setPending] = useState<Pending>({ kind: "keep" });
  const [choice, setChoice] = useState<AvatarChoice | null>(null);
  const [checked, setChecked] = useState(false);
  const [status, setStatus] = useState<ButtonStatus>("idle");
  const [photoFailed, setPhotoFailed] = useState(false);

  // A cut photo is shown from an object URL while it waits to be saved.
  const preview = pending.kind === "photo" ? pending.preview : null;
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  const shown = pending.kind === "keep" ? team.avatarUrl : pending.kind === "avatar" ? pending.url : pending.preview;
  const busy = status === "loading";
  const nameError = checked && name.trim() === "" ? text.nameRequired : undefined;
  const leaderError = checked && leader.trim() === "" ? text.leaderRequired : undefined;

  // Back on the details from the photo's view, the focus returns to Change Photo.
  const changeRef = useRef<HTMLButtonElement>(null);
  const returned = useRef(false);
  useEffect(() => {
    if (view === "details" && returned.current) changeRef.current?.focus();
  }, [view]);

  const show = (next: "details" | "photo") => {
    returned.current = next === "details";
    setView(next);
    onViewChange(next);
  };

  const run = async (action: () => Promise<void>) => {
    setStatus("loading");
    onBusyChange(true);
    try {
      await action();
    } finally {
      setStatus("idle");
      onBusyChange(false);
    }
  };

  const takeChoice = () =>
    run(async () => {
      if (!choice) return;
      if (choice.kind === "avatar") {
        setPending({ kind: "avatar", url: choice.url });
        show("details");
        return;
      }
      try {
        const image = await photoOf(choice);
        if (!image) throw new Error("No photo");
        setPending({ kind: "photo", image, preview: URL.createObjectURL(image) });
        setPhotoFailed(false);
        show("details");
      } catch {
        setPhotoFailed(true);
      }
    });

  const save = () => {
    setChecked(true);
    if (name.trim() === "" || leader.trim() === "" || busy) return;
    const avatar: TeamAvatarChange = pending.kind === "photo" ? { kind: "photo", image: pending.image } : pending;
    void run(async () => {
      try {
        await onSave({ teamName: name.trim(), teamLeader: leader.trim(), avatar });
      } catch {
        // The dialog stays open for another try; the page says why through `error`.
        return;
      }
      onDone();
    });
  };

  if (view === "photo") {
    return (
      <>
        <div className={dialog.header()}>
          <BaseDialog.Title className={dialog.title()}>{text.photoTitle}</BaseDialog.Title>
          <BaseDialog.Description className={dialog.description()}>{text.photoDescription}</BaseDialog.Description>
        </div>
        {photoFailed ? <Alert tone="danger">{text.photoFailed}</Alert> : null}
        <AvatarPicker
          autoFocus
          seed={name.trim() || team.name}
          current={shown}
          onChoiceChange={setChoice}
          messages={pickerMessages}
          builderMessages={builderMessages}
          cropperMessages={cropperMessages}
        />
        <div className={dialog.footer()}>
          <Button variant="text" onClick={() => show("details")} disabled={busy}>
            {text.back}
          </Button>
          <Button status={status} disabled={!choice} onClick={() => void takeChoice()}>
            {choice?.kind === "photo" ? text.usePhoto : text.useAvatar}
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={dialog.header()}>
        <BaseDialog.Title className={dialog.title()}>{text.title}</BaseDialog.Title>
        <BaseDialog.Description className={dialog.description()}>{text.description}</BaseDialog.Description>
      </div>
      <div className={slots.fields()}>
        <div className={slots.photoRow()}>
          <span className={slots.photoLabel()}>{text.profilePhoto}</span>
          <div className={slots.photoActions()}>
            <Avatar name={name.trim() || team.name} src={shown} size="xl" />
            <div className={slots.photoButtons()}>
              <Button ref={changeRef} onClick={() => show("photo")} disabled={busy}>
                {text.changePhoto}
              </Button>
              <Button
                variant="outline"
                tone="danger"
                size="md"
                onClick={() => setPending({ kind: "avatar", url: avatarUrl({ style: defaultAvatarStyle, seed: randomSeed(), choices: {} }) })}
                disabled={busy}
              >
                {text.deletePhoto}
              </Button>
            </div>
          </div>
        </div>
        <TextField
          ref={nameRef}
          label={text.teamName}
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
          error={nameError}
          disabled={busy}
          autoComplete="off"
        />
        <TextField
          label={text.teamLeader}
          value={leader}
          onChange={(event) => setLeader(event.currentTarget.value)}
          error={leaderError}
          disabled={busy}
          autoComplete="off"
        />
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className={dialog.footer()}>
        <BaseDialog.Close
          render={
            <Button variant="text" disabled={busy}>
              {text.cancel}
            </Button>
          }
        />
        <Button status={status} onClick={save}>
          {text.save}
        </Button>
      </div>
    </>
  );
}
