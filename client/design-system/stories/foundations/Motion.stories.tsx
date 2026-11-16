import type { Meta, StoryObj } from "@storybook/react-vite";
import { AnimatePresence, m, useAnimate, type TargetAndTransition } from "motion/react";
import { useState, type ReactNode } from "react";
import { expect, waitFor } from "storybook/test";
import {
  enter,
  fade,
  motionTokens,
  nudge,
  scaleIn,
  shake,
  staggerList,
  successPop,
  Text,
  useReducedEffects,
} from "../../src";
import { Code, DocPage, DocSection } from "./docs";

const meta = {
  title: "Foundations/Motion",
  parameters: { layout: "padded" },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function PlayButton({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-(--button-height-sm) cursor-pointer rounded-xl border border-line-primary bg-surface-card px-3 type-button text-fg-link hover:bg-primary-soft"
    >
      {children}
    </button>
  );
}

function Track({ label, meta: detail, children }: { label: ReactNode; meta: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-12 items-center gap-4">
      <div className="col-span-3 flex flex-col">
        <Text as="div" variant="label" tone="primary">
          {label}
        </Text>
        <Text as="div" variant="caption" tone="muted">
          {detail}
        </Text>
      </div>
      <div className="relative col-span-9 h-6 rounded-full bg-surface-panel">{children}</div>
    </div>
  );
}

function Durations() {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const play = () => {
    for (const [name, seconds] of Object.entries(motionTokens.duration)) {
      void animate(`[data-duration="${name}"]`, { x: [0, 240] }, { duration: seconds, ease: motionTokens.ease.standard });
    }
  };
  return (
    <div ref={scope} className="flex flex-col gap-3">
      <PlayButton onClick={play}>Play durations</PlayButton>
      {Object.entries(motionTokens.duration).map(([name, seconds]) => (
        <Track key={name} label={<Code>{`duration-${name}`}</Code>} meta={`${seconds * 1000} ms`}>
          <div data-duration={name} className="absolute top-1 left-1 size-4 rounded-full bg-primary" />
        </Track>
      ))}
    </div>
  );
}

function Easings() {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const play = () => {
    for (const [name, curve] of Object.entries(motionTokens.ease)) {
      void animate(`[data-ease="${name}"]`, { x: [0, 240] }, { duration: motionTokens.duration.slower, ease: curve });
    }
  };
  return (
    <div ref={scope} className="flex flex-col gap-3">
      <PlayButton onClick={play}>Play easings</PlayButton>
      {Object.entries(motionTokens.ease).map(([name, curve]) => (
        <Track key={name} label={<Code>{`ease-${name}`}</Code>} meta={`cubic-bezier(${curve.join(", ")})`}>
          <div data-ease={name} className="absolute top-1 left-1 size-4 rounded-full bg-accent" />
        </Track>
      ))}
    </div>
  );
}

function Feedback({ name, target, description, children }: { name: string; target: TargetAndTransition; description: string; children: ReactNode }) {
  const [scope, animate] = useAnimate<HTMLDivElement>();
  const reduced = useReducedEffects();
  const { transition, ...keyframes } = target;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-card p-4">
      <div ref={scope} className="self-start">
        {children}
      </div>
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col">
          <Text as="div" variant="label" tone="primary">
            <Code>{name}</Code>
          </Text>
          <Text as="div" variant="caption" tone="muted">
            {description}
          </Text>
        </div>
        <PlayButton onClick={() => void (reduced ? undefined : animate(scope.current, keyframes, transition))}>Play</PlayButton>
      </div>
    </div>
  );
}

function Presence() {
  const [shown, setShown] = useState(true);
  return (
    <div className="flex flex-col gap-4">
      <PlayButton onClick={() => setShown((value) => !value)}>{shown ? "Hide" : "Show"}</PlayButton>
      <div className="grid grid-cols-3 gap-4">
        {[
          { name: "fade", variants: fade },
          { name: "enter", variants: enter },
          { name: "scaleIn", variants: scaleIn },
        ].map(({ name, variants }) => (
          <div key={name} className="flex h-32 flex-col gap-2">
            <Text as="div" variant="label" tone="primary">
              <Code>{name}</Code>
            </Text>
            <AnimatePresence>
              {shown ? (
                <m.div
                  key={name}
                  variants={variants}
                  initial="hidden"
                  animate="visible"
                  exit="exit"
                  className="h-16 rounded-2xl bg-accent-soft shadow-card"
                />
              ) : null}
            </AnimatePresence>
          </div>
        ))}
      </div>
    </div>
  );
}

function Stagger() {
  const [round, setRound] = useState(0);
  return (
    <div className="flex flex-col gap-4">
      <PlayButton onClick={() => setRound((value) => value + 1)}>Replay</PlayButton>
      <m.ul key={round} variants={staggerList} initial="hidden" animate="visible" className="flex gap-3">
        {["Market Share", "Revenue", "CSAT", "ESAT", "Energy"].map((label) => (
          <m.li key={label} variants={enter} className="rounded-3xl bg-surface-card px-3 py-1.5 type-kpi-label text-fg-primary shadow-sm">
            {label}
          </m.li>
        ))}
      </m.ul>
    </div>
  );
}

export const Tokens: Story = {
  render: () => (
    <DocPage
      title="Motion"
      intro={
        <>
          Durations and easings from the Figma prototype, as Tailwind utilities (<Code>duration-fast</Code>, <Code>ease-standard</Code>) and as
          motionTokens for Motion. Everything respects reduced motion and the app&apos;s Reduce effects switch (toolbar: Effects).
        </>
      }
    >
      <DocSection title="Durations">
        <Durations />
      </DocSection>
      <DocSection title="Easings">
        <Easings />
      </DocSection>
    </DocPage>
  ),
};

export const Presets: Story = {
  play: async ({ canvas, userEvent }) => {
    // The shake really moves the field, and settles back.
    const field = canvas.getByText("120%");
    const [playShake] = canvas.getAllByRole("button", { name: "Play" });
    if (!playShake || !field.parentElement) throw new Error("the shake demo is missing");
    const moving = field.parentElement;
    await userEvent.click(playShake);
    await waitFor(() => expect(getComputedStyle(moving).transform).toMatch(/^matrix\(1, 0, 0, 1, -?\d/));
    await waitFor(() => expect(["none", "matrix(1, 0, 0, 1, 0, 0)"]).toContain(getComputedStyle(moving).transform), { timeout: 2000 });
  },
  render: () => (
    <DocPage title="Motion presets" intro="Reusable animations for components. Refusals keep today's shake, keyframe for keyframe.">
      <DocSection title="Feedback">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Feedback name="shake" target={shake} description="A value is refused (decision fields).">
            <div className="flex h-(--input-height-md) w-48 items-center rounded-lg border border-line-danger-soft bg-surface-card px-4 type-body-lg text-fg-primary">
              120%
            </div>
          </Feedback>
          <Feedback name="nudge" target={nudge} description="Not enough energy, over budget.">
            <div className="flex h-(--chip-height) items-center rounded-lg bg-energy px-1.5 type-caption text-fg-on-energy">Energy 12</div>
          </Feedback>
          <Feedback name="successPop" target={successPop} description="A small success.">
            <div className="flex size-10 items-center justify-center rounded-full bg-success-soft type-heading text-fg-success">✓</div>
          </Feedback>
        </div>
      </DocSection>
      <DocSection title="Enter and exit" description="Variants for AnimatePresence: initial hidden, animate visible, exit exit.">
        <Presence />
      </DocSection>
      <DocSection title="Stagger" description="staggerList: children with a variant appear one after another.">
        <Stagger />
      </DocSection>
    </DocPage>
  ),
};
