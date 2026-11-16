import type { Meta, StoryObj } from "@storybook/react-vite";
import { Bell, ChevronRight, CircleAlert, CircleCheckBig, DollarSign, House, Layers, RotateCw, Sparkles, TrendingDown, TrendingUp, Zap } from "lucide-react";
import { useRef } from "react";
import { expect, waitFor } from "storybook/test";
import {
  AnimatedIcon,
  Icon,
  iconAnimations,
  iconNames,
  iconRegistry,
  iconSizes,
  iconStrokes,
  IconPlayProvider,
  renamedIcons,
  SlashSeparator,
  Text,
  useIconPlay,
  type AnimatedIconHandle,
  type IconAnimationName,
} from "../../src";
import { Code, DocPage, DocSection, Specimen } from "./docs";

const meta = {
  title: "Foundations/Icons",
  component: Icon,
  parameters: { layout: "padded" },
  args: { icon: Zap, size: "md", stroke: "thin" },
  argTypes: {
    icon: { control: false },
    size: { control: "inline-radio", options: Object.keys(iconSizes) },
    stroke: { control: "inline-radio", options: Object.keys(iconStrokes) },
    label: { control: "text" },
  },
} satisfies Meta<typeof Icon>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  render: (args) => (
    <div className="text-fg-primary">
      <Icon {...args} />
    </div>
  ),
};

const sizes = Object.keys(iconSizes) as (keyof typeof iconSizes)[];
const strokes = Object.keys(iconStrokes) as (keyof typeof iconStrokes)[];

export const SizesAndStrokes: Story = {
  parameters: {
    // The cost chip reproduces the Figma colours: white 12 px text on 85% pink measures 3.5:1, below AA.
    // It is on the owner's list (design-system PRD, section 8); the rule still checks everything else.
    a11y: { config: { rules: [{ id: "color-contrast", selector: "*:not([data-figma-contrast-exception] *)" }] } },
  },
  render: () => (
    <DocPage
      title="Icons"
      intro={
        <>
          Lucide icons, drawn with an absolute stroke: the Figma screens use 1 px at every size (<Code>thin</Code>, the default).{" "}
          <Code>regular</Code> and <Code>bold</Code> are there for legibility on low-density screens and projectors; the owner decides where they
          apply.
        </>
      }
    >
      <DocSection title="Sizes and strokes" description="Rows are strokes, columns are sizes (12, 14, 16, 20, 24, 28 px).">
        <div className="flex flex-col gap-4 text-fg-primary">
          {strokes.map((stroke) => (
            <div key={stroke} className="grid grid-cols-7 items-center gap-4">
              <Text as="div" variant="label" tone="primary">
                <Code>{`stroke="${stroke}"`}</Code> {iconStrokes[stroke]} px
              </Text>
              {sizes.map((size) => (
                <div key={size} className="flex items-center gap-2">
                  <Icon icon={Zap} size={size} stroke={stroke} />
                  <Icon icon={DollarSign} size={size} stroke={stroke} />
                  <Icon icon={Layers} size={size} stroke={stroke} />
                  <Icon icon={CircleAlert} size={size} stroke={stroke} />
                </div>
              ))}
            </div>
          ))}
        </div>
      </DocSection>
      <DocSection title="In context" description="The resource chips of the player screens: 14 px icons on 85% brand colours.">
        <div className="flex gap-2" data-figma-contrast-exception>
          <span className="flex h-(--chip-height) items-center gap-0.5 rounded-lg bg-(--chip-energy-bg) px-1.5 type-caption text-fg-on-energy">
            <Icon icon={Zap} size="sm" /> 12
          </span>
          <span className="flex h-(--chip-height) items-center gap-0.5 rounded-lg bg-(--chip-cost-bg) px-1.5 type-caption text-fg-on-primary">
            <Icon icon={DollarSign} size="sm" /> 5k
          </span>
          <span className="flex h-(--chip-height) items-center gap-0.5 rounded-lg bg-(--chip-level-bg) px-1.5 type-caption text-fg-on-accent">
            <Icon icon={Layers} size="sm" /> 3
          </span>
        </div>
        <nav aria-label="Breadcrumb example" className="flex items-center gap-2.5 type-body text-fg-muted">
          <Icon icon={House} size="md" />
          <Icon icon={SlashSeparator} size="md" className="text-fg-faint" />
          <span>Simulations</span>
          <Icon icon={SlashSeparator} size="md" className="text-fg-faint" />
          <span className="font-semibold text-fg-primary">Novabank Growth Simulation</span>
        </nav>
      </DocSection>
    </DocPage>
  ),
};

export const Registry: Story = {
  render: () => (
    <DocPage
      title="Icon names"
      intro={
        <>
          Configuration names icons as text (a product&apos;s sidebar icon, for example). <Code>resolveIcon(name)</Code> accepts lucide names, the
          PascalCase names today&apos;s configuration stores, and renamed old names. In code, import the icon itself.
        </>
      }
    >
      <DocSection title="Registry" description={`${iconNames.length} icons that data can name.`}>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
          {iconNames.map((name) => (
            <div key={name} className="flex items-center gap-2 rounded-lg border border-line bg-surface-card p-2 text-fg-primary">
              <Icon icon={iconRegistry[name]} size="lg" />
              <Text as="span" variant="caption" tone="body" truncate>
                {name}
              </Text>
            </div>
          ))}
        </div>
      </DocSection>
      <DocSection title="Renamed icons" description="Old lucide names in the Figma file and older data, and what they are called now.">
        <div className="grid grid-cols-1 gap-1 md:grid-cols-2">
          {Object.entries(renamedIcons).map(([oldName, current]) => (
            <Text key={oldName} as="div" variant="body" tone="body">
              <Code>{oldName}</Code> is <Code>{current}</Code>
            </Text>
          ))}
          <Text as="div" variant="body" tone="body">
            <Code>slash-bold</Code> is <Code>SlashSeparator</Code> (design system)
          </Text>
          <Text as="div" variant="body" tone="body">
            <Code>graph-up-arrow</Code> is <Code>trending-up</Code>
          </Text>
        </div>
      </DocSection>
    </DocPage>
  ),
};

const animationIcons: Record<IconAnimationName, typeof Zap> = {
  pop: CircleCheckBig,
  wiggle: Bell,
  spin: RotateCw,
  bounce: Zap,
  rise: TrendingUp,
  sink: TrendingDown,
  shake: CircleAlert,
  pulse: Sparkles,
  draw: CircleCheckBig,
};

function ParentHoverDemo() {
  const { signal, play } = useIconPlay();
  return (
    <button
      type="button"
      onPointerEnter={play}
      onFocus={play}
      className="flex h-(--button-height-md) cursor-pointer items-center gap-2 rounded-xl bg-primary px-4 type-button text-fg-on-primary"
      data-figma-contrast-exception
    >
      <IconPlayProvider signal={signal}>
        Next round
        <AnimatedIcon icon={ChevronRight} animation="bounce" trigger="parent" stroke="bold" />
      </IconPlayProvider>
    </button>
  );
}

export const Animated: Story = {
  parameters: {
    // The demo button is the Figma primary: white on pink is 3.9:1, an open brand decision (see Text, Tones).
    a11y: { config: { rules: [{ id: "color-contrast", selector: "*:not([data-figma-contrast-exception])" }] } },
  },
  play: async ({ canvas, userEvent }) => {
    const moves = (element: Element) => waitFor(() => expect(getComputedStyle(element).transform).not.toBe("none"));

    // Hovering an icon plays it.
    const pop = canvas.getByRole("img", { name: "pop" });
    await userEvent.hover(pop);
    await moves(pop);

    // Hovering the button plays the icon inside it.
    const button = canvas.getByRole("button", { name: "Next round" });
    const chevron = button.querySelector("svg");
    if (!chevron) throw new Error("the button has no icon");
    await userEvent.hover(button);
    await moves(chevron);
  },
  render: function Render() {
    const handles = useRef<Partial<Record<IconAnimationName, AnimatedIconHandle | null>>>({});
    const names = Object.keys(iconAnimations) as IconAnimationName[];
    return (
      <DocPage
        title="Animated icons"
        intro="Any icon can move: on hover (default), with its parent, on mount, when a value changes, or on demand. Nothing moves while effects are reduced."
      >
        <DocSection title="Animations" description="Hover an icon, or play them all.">
          <button
            type="button"
            // An AnimatedIcon handle's play(), not a story's play function.
            // eslint-disable-next-line storybook/context-in-play-function
            onClick={() => names.forEach((name) => handles.current[name]?.play())}
            className="h-(--button-height-sm) cursor-pointer self-start rounded-xl border border-line-primary bg-surface-card px-3 type-button text-fg-link hover:bg-primary-soft"
          >
            Play all
          </button>
          <div className="grid grid-cols-3 gap-4 md:grid-cols-5">
            {names.map((name) => (
              <Specimen key={name} label={<Code>{name}</Code>}>
                <div className="text-accent">
                  <AnimatedIcon
                    ref={(handle) => {
                      handles.current[name] = handle;
                    }}
                    icon={animationIcons[name]}
                    animation={name}
                    size="2xl"
                    stroke="regular"
                    label={name}
                  />
                </div>
              </Specimen>
            ))}
          </div>
        </DocSection>
        <DocSection title="With a parent" description="The icon plays when its button is hovered or focused (trigger parent).">
          <ParentHoverDemo />
        </DocSection>
      </DocPage>
    );
  },
};
