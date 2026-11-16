import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import type { StyleDefinition } from "@dicebear/core";
import { Ban, Shuffle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "../../foundations/icon/Icon";
import { tv } from "../../lib/tv";
import { Button } from "../button/Button";
import { Skeleton } from "../skeleton/Skeleton";
import { Tabs, TabsPanel } from "../tabs/Tabs";
import {
  avatarBackgroundsOf,
  avatarColours,
  avatarParts,
  avatarStyleKeys,
  avatarStyles,
  avatarUrl,
  defaultAvatarStyle,
  loadAvatarStyle,
  parseAvatarUrl,
  renderAvatar,
  type AvatarRecipe,
  type AvatarStyleKey,
} from "./dicebear";

export interface AvatarBuilderMessages {
  /** Names the preview for assistive technology. */
  preview: string;
  /** Names the list of styles. */
  styles: string;
  /** Names the categories' tab list. */
  categories: string;
  shuffle: string;
  /** Leaves an optional part (glasses, earrings) or the background out. */
  none: string;
  background: string;
  /** A part's name from its key in the style ("facialHair" is "Facial hair"). */
  part: (label: string) => string;
  /** A colour's name from its key ("hair" is "Hair colour"). */
  colour: (label: string) => string;
  /** Names a variant in its part's list, counted from 1. */
  option: (index: number) => string;
  /** Names a colour in its palette, counted from 1. */
  swatch: (index: number) => string;
  /** The credit a style's licence asks for. */
  credit: (style: string, creator: string, licence: string) => string;
}

/** "facialHair" and "top-hat" read as "Facial hair" and "Top hat". */
function humanise(key: string) {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
    .toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

const defaultMessages: AvatarBuilderMessages = {
  preview: "Your avatar",
  styles: "Style",
  categories: "Parts and colours",
  shuffle: "Shuffle",
  none: "None",
  background: "Background",
  part: (label) => label,
  colour: (label) => `${label} colour`,
  option: (index) => `Option ${index}`,
  swatch: (index) => `Colour ${index}`,
  credit: (style, creator, licence) => `${style} by ${creator}, ${licence}`,
};

/**
 * Choosing a team's avatar from DiceBear's styles, part by part: the avatar as it will look, a
 * Shuffle that draws a new one, the styles, then a tab per part (hair, eyes, glasses...) with
 * each variant drawn on the avatar itself, a tab per colour with the style's palette, and the
 * background. Everything is drawn here; the value is the DiceBear address the team keeps (see
 * dicebear.ts), so the page saves it in `avatarUrl` as today.
 */
export const avatarBuilderVariants = tv({
  slots: {
    root: "flex flex-col gap-6 sm:flex-row sm:items-start",
    aside: "flex shrink-0 flex-col items-center gap-3 sm:w-40",
    preview: "size-32 overflow-hidden rounded-full bg-surface-panel inset-ring inset-ring-line",
    image: "size-full",
    main: "flex min-w-0 flex-1 flex-col gap-4",
    styleList: "flex flex-wrap gap-2",
    styleItem: [
      "flex w-20 cursor-pointer flex-col items-center gap-1 rounded-lg p-1.5 text-center transition-colors duration-fast ease-standard",
      "outline-offset-2 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus-ring",
      "data-checked:bg-surface-selected data-checked:inset-ring-2 data-checked:inset-ring-accent",
    ],
    styleThumb: "size-12 overflow-hidden rounded-full bg-surface-panel",
    styleName: "w-full truncate type-caption text-fg-muted",
    grid: "avatar-options grid gap-2",
    option: [
      "flex aspect-square cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-surface-panel p-1 text-fg-subtle transition-colors duration-fast ease-standard",
      "outline-offset-2 hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-focus-ring",
      "data-checked:bg-surface-selected data-checked:inset-ring-2 data-checked:inset-ring-accent",
    ],
    swatches: "flex flex-wrap gap-3 py-1",
    swatch: [
      "flex size-9 cursor-pointer items-center justify-center rounded-full text-fg-subtle inset-ring inset-ring-line-strong",
      "outline-offset-2 focus-visible:outline-2 focus-visible:outline-focus-ring",
      "data-checked:ring-2 data-checked:ring-accent data-checked:ring-offset-2",
    ],
    credit: "type-caption text-fg-subtle",
    loading: "size-full",
  },
});

export interface AvatarBuilderProps {
  /** The avatar, as the DiceBear address the team keeps. Anything else (a photo, nothing) starts from `seed`. */
  value?: string | null;
  /** The avatar at first, when the builder keeps its own value. */
  defaultValue?: string | null;
  /** Each change, as the address to keep. */
  onValueChange?: (url: string) => void;
  /** What a new avatar starts from: the team's name, so the same team starts from the same avatar. */
  seed: string;
  /** The styles to offer, in order. Default: all of avatarStyles. */
  styles?: readonly AvatarStyleKey[];
  messages?: Partial<AvatarBuilderMessages>;
  className?: string;
}

/** The styles' definitions, as each arrives. */
function useDefinitions(keys: readonly AvatarStyleKey[]) {
  const [loaded, setLoaded] = useState<Partial<Record<AvatarStyleKey, StyleDefinition>>>({});
  useEffect(() => {
    let live = true;
    for (const key of keys) {
      void loadAvatarStyle(key).then((definition) => {
        if (live) setLoaded((current) => (current[key] ? current : { ...current, [key]: definition }));
      });
    }
    return () => {
      live = false;
    };
  }, [keys]);
  return loaded;
}

/** A seed no team is likely to have: Shuffle's new avatar. */
function randomSeed() {
  return Math.random().toString(36).slice(2, 10);
}

/** Choosing a team's avatar from DiceBear's styles, part by part and colour by colour. */
export function AvatarBuilder({
  value,
  defaultValue,
  onValueChange,
  seed,
  styles = avatarStyleKeys,
  messages,
  className,
}: AvatarBuilderProps) {
  const text = { ...defaultMessages, ...messages };
  const slots = avatarBuilderVariants();
  const [own, setOwn] = useState(defaultValue ?? null);
  const current = value !== undefined ? value : own;
  const offered = styles.length > 0 ? styles : avatarStyleKeys;
  const recipe: AvatarRecipe = useMemo(() => {
    const parsed = parseAvatarUrl(current);
    if (parsed && offered.includes(parsed.style)) return parsed;
    return { style: offered.includes(defaultAvatarStyle) ? defaultAvatarStyle : offered[0]!, seed, choices: {} };
  }, [current, offered, seed]);
  const definitions = useDefinitions(offered);
  const definition = definitions[recipe.style];

  const change = (next: AvatarRecipe) => {
    const url = avatarUrl(next);
    if (value === undefined) setOwn(url);
    onValueChange?.(url);
  };
  const choose = (choices: Record<string, string | undefined>) => {
    const next: Record<string, string> = { ...recipe.choices };
    for (const [key, choice] of Object.entries(choices)) {
      if (choice === undefined) delete next[key];
      else next[key] = choice;
    }
    change({ ...recipe, choices: next });
  };

  const parts = useMemo(() => (definition ? avatarParts(definition) : []), [definition]);
  const colours = useMemo(() => (definition ? avatarColours(definition) : []), [definition]);
  const backgrounds = useMemo(() => (definition ? avatarBackgroundsOf(definition) : { values: [], none: true }), [definition]);
  const categories = useMemo(
    () => [
      ...parts.map((part) => ({ value: `part:${part.key}`, label: text.part(humanise(part.key)) })),
      ...colours.map((colour) => ({ value: `colour:${colour.key}`, label: text.colour(humanise(colour.key)) })),
      { value: "background", label: text.background },
    ],
    // The messages are read afresh on each render; the categories follow the style.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [parts, colours],
  );
  const [category, setCategory] = useState<string | undefined>(undefined);
  const openCategory = category && categories.some((item) => item.value === category) ? category : categories[0]?.value;

  const meta = definition?.meta;
  const credit =
    meta?.creator?.name && meta.license?.name ? text.credit(avatarStyles[recipe.style].label, meta.creator.name, meta.license.name) : null;

  return (
    <div className={slots.root({ className })}>
      <div className={slots.aside()}>
        <div className={slots.preview()}>
          {definition ? (
            <img className={slots.image()} src={renderAvatar(definition, recipe)} alt={text.preview} />
          ) : (
            <Skeleton className={slots.loading()} />
          )}
        </div>
        <Button variant="outline" size="sm" iconStart={Shuffle} onClick={() => change({ ...recipe, seed: randomSeed(), choices: {} })}>
          {text.shuffle}
        </Button>
      </div>
      <div className={slots.main()}>
        <RadioGroup
          aria-label={text.styles}
          value={recipe.style}
          // A new style starts afresh from the same seed; the background carries over.
          onValueChange={(style) =>
            change({
              style,
              seed: recipe.seed,
              choices: recipe.choices.backgroundColor ? { backgroundColor: recipe.choices.backgroundColor } : {},
            })
          }
          className={slots.styleList()}
        >
          {offered.map((key) => {
            const styleDefinition = definitions[key];
            return (
              <Radio.Root key={key} value={key} className={slots.styleItem()}>
                <span className={slots.styleThumb()}>
                  {styleDefinition ? (
                    <img className={slots.image()} src={renderAvatar(styleDefinition, { style: key, seed: recipe.seed, choices: {} })} alt="" />
                  ) : (
                    <Skeleton className={slots.loading()} />
                  )}
                </span>
                <span className={slots.styleName()}>{avatarStyles[key].label}</span>
              </Radio.Root>
            );
          })}
        </RadioGroup>
        {definition && openCategory ? (
          <Tabs label={text.categories} tabs={categories} value={openCategory} onValueChange={setCategory}>
            {parts.map((part) => {
              const variantKey = `${part.key}Variant`;
              const probabilityKey = `${part.key}Probability`;
              const chosen = recipe.choices[probabilityKey] === "0" ? "none" : (recipe.choices[variantKey] ?? "");
              // Choosing a variant of an optional part also shows it; None hides it.
              const shown = part.optional ? { [probabilityKey]: "100" } : {};
              return (
                <TabsPanel key={part.key} value={`part:${part.key}`}>
                  <RadioGroup
                    aria-label={text.part(humanise(part.key))}
                    value={chosen}
                    onValueChange={(variant) =>
                      choose(
                        variant === "none"
                          ? { [variantKey]: undefined, [probabilityKey]: "0" }
                          : { [variantKey]: String(variant), [probabilityKey]: part.optional ? "100" : undefined },
                      )
                    }
                    className={slots.grid()}
                  >
                    {part.optional ? (
                      <Radio.Root value="none" aria-label={text.none} className={slots.option()}>
                        <Icon icon={Ban} size="xl" />
                      </Radio.Root>
                    ) : null}
                    {part.variants.map((variant, index) => (
                      <Radio.Root key={variant} value={variant} aria-label={text.option(index + 1)} className={slots.option()}>
                        <img className={slots.image()} src={renderAvatar(definition, recipe, { [variantKey]: variant, ...shown })} alt="" />
                      </Radio.Root>
                    ))}
                  </RadioGroup>
                </TabsPanel>
              );
            })}
            {colours.map((colour) => {
              const colourKey = `${colour.key}Color`;
              return (
                <TabsPanel key={colour.key} value={`colour:${colour.key}`}>
                  <Swatches
                    label={text.colour(humanise(colour.key))}
                    values={colour.values}
                    chosen={recipe.choices[colourKey] ?? ""}
                    onChoose={(hex) => choose({ [colourKey]: hex })}
                    text={text}
                  />
                </TabsPanel>
              );
            })}
            <TabsPanel value="background">
              <Swatches
                label={text.background}
                values={backgrounds.values}
                chosen={recipe.choices.backgroundColor ?? (backgrounds.none ? "none" : "")}
                onChoose={(hex) => choose({ backgroundColor: hex === "none" ? undefined : hex })}
                none={backgrounds.none}
                text={text}
              />
            </TabsPanel>
          </Tabs>
        ) : null}
        {credit ? <p className={slots.credit()}>{credit}</p> : null}
      </div>
    </div>
  );
}

interface SwatchesProps {
  label: string;
  values: readonly string[];
  chosen: string;
  onChoose: (hex: string) => void;
  /** Offers None first (the background). */
  none?: boolean;
  text: AvatarBuilderMessages;
}

/** A palette as round swatches; the colours are the avatar's data, so they are set inline. */
function Swatches({ label, values, chosen, onChoose, none = false, text }: SwatchesProps) {
  const slots = avatarBuilderVariants();
  return (
    <RadioGroup aria-label={label} value={chosen} onValueChange={(hex) => onChoose(String(hex))} className={slots.swatches()}>
      {none ? (
        <Radio.Root value="none" aria-label={text.none} className={slots.swatch()}>
          <Icon icon={Ban} size="md" />
        </Radio.Root>
      ) : null}
      {values.map((hex, index) => (
        <Radio.Root key={hex} value={hex} aria-label={text.swatch(index + 1)} title={`#${hex}`} className={slots.swatch()} style={{ backgroundColor: `#${hex}` }} />
      ))}
    </RadioGroup>
  );
}
