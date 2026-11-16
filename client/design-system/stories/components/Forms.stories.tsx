import type { Meta, StoryObj } from "@storybook/react-vite";
import { Plus, Search } from "lucide-react";
import { useState, type FormEvent } from "react";
import { expect, userEvent } from "storybook/test";
import { Button, Heading, IconButton, Input, PasswordField, Text, TextField } from "../../src";
import { DocPage, DocSection } from "../foundations/docs";
import { figmaButtonContrastException } from "../support/a11y";

const meta = {
  title: "Components/Forms",
  parameters: { layout: "padded", ...figmaButtonContrastException },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Fields: Story = {
  render: () => (
    <DocPage
      title="Text fields"
      intro="The Preline input of the Figma forms: 47 px, gray border, 8 px corners, 15 px text; red when invalid. The label, help and error are wired to the input for screen readers."
    >
      <DocSection title="States">
        <div className="grid max-w-5xl grid-cols-1 gap-6 rounded-2xl bg-surface-card p-6 md:grid-cols-2">
          <TextField label="Simulation name" placeholder="Novabank Growth Simulation" />
          <TextField label="Simulation name" required defaultValue="Novabank Growth Simulation" />
          <TextField label="Email" defaultValue="du12d1o@.com" error="Please enter a valid email address" />
          <TextField label="Facilitator" description="Shown to the teams in the lobby." placeholder="Name" />
          <TextField label="Organisation" defaultValue="intlabs" disabled />
          <PasswordField label="Password" defaultValue="correct horse battery" />
        </div>
      </DocSection>
      <DocSection title="Inputs on their own" description="47 px in forms, 42 px for search and filters, 38 px in dense rows.">
        <div className="flex max-w-xl flex-col gap-4 rounded-2xl bg-surface-card p-6">
          <Input aria-label="Search simulations" placeholder="Search simulations" startIcon={Search} />
          <Input aria-label="Search products" placeholder="Search products" startIcon={Search} size="md" />
          <Input aria-label="Delay in minutes" defaultValue="0" size="sm" align="end" inputMode="numeric" />
        </div>
      </DocSection>
    </DocPage>
  ),
};

/** The root of the field around an input. */
function fieldOf(input: HTMLElement) {
  const root = input.parentElement;
  if (!root) throw new Error("The input has no field around it.");
  return root;
}

/** A disabled button beside the text (a stepper's plus at its maximum) leaves the field as it is; a disabled input greys it. */
export const DisabledButtonBeside: Story = {
  render: () => (
    <div className="flex max-w-xs flex-col gap-4 rounded-2xl bg-surface-card p-6">
      <Input
        aria-label="Number of teams"
        defaultValue="5"
        endAdornment={<IconButton icon={Plus} label="Add a team" variant="outline" size="sm" disabled focusableWhenDisabled />}
      />
      <Input aria-label="Rounds" defaultValue="3" disabled />
    </div>
  ),
  play: async ({ canvas }) => {
    await expect(getComputedStyle(fieldOf(canvas.getByRole("textbox", { name: "Number of teams" }))).opacity).toBe("1");
    await expect(getComputedStyle(fieldOf(canvas.getByRole("textbox", { name: "Rounds" }))).opacity).toBe("0.5");
  },
};

function AdminLogin() {
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const emailValue = data.get("email");
    const email = typeof emailValue === "string" ? emailValue : "";
    setErrors({
      email: /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ? undefined : "Please enter a valid email address",
      password: data.get("password") ? undefined : "Please enter your password",
    });
  };
  return (
    <form noValidate onSubmit={submit} className="flex w-full max-w-xl flex-col gap-10 rounded-4xl border border-line-strong bg-surface-card p-10">
      <div className="flex flex-col gap-4 border-b border-line pb-6">
        <Heading level={1} variant="modal-title">
          Stratagem
        </Heading>
        <Text variant="body-lg" tone="body">
          Experience the ultimate simulation. Strategize, optimize and lead your team to success.
        </Text>
      </div>
      <div className="flex flex-col gap-4">
        <TextField label="Email" name="email" type="email" autoComplete="username" error={errors.email} />
        <PasswordField label="Password" name="password" autoComplete="current-password" error={errors.password} />
      </div>
      <Button type="submit" fullWidth>
        Login
      </Button>
    </form>
  );
}

export const AdminLoginForm: Story = {
  name: "Admin login (Figma)",
  render: () => <AdminLogin />,
  play: async ({ canvas }) => {
    await userEvent.type(canvas.getByRole("textbox", { name: "Email" }), "du12d1o@.com");
    await userEvent.click(canvas.getByRole("button", { name: "Login" }));
    const email = canvas.getByRole("textbox", { name: "Email" });
    await expect(email).toHaveAttribute("aria-invalid", "true");
    await expect(email).toHaveAccessibleDescription("Please enter a valid email address");
    await expect(canvas.getByText("Please enter your password")).toBeVisible();

    await userEvent.clear(email);
    await userEvent.type(email, "facilitator@example.com");
    const password = canvas.getByLabelText("Password");
    await userEvent.type(password, "correct-horse-battery");
    await userEvent.click(canvas.getByRole("button", { name: "Show password" }));
    await expect(password).toHaveAttribute("type", "text");
    await userEvent.click(canvas.getByRole("button", { name: "Login" }));
    await expect(email).not.toHaveAttribute("aria-invalid", "true");
  },
};

export const ChangePassword: Story = {
  name: "Change your password (Figma)",
  render: () => (
    <div className="flex w-full max-w-lg flex-col gap-8 rounded-3xl bg-surface-card p-8 shadow-modal">
      <div className="flex flex-col gap-3">
        <Heading level={2} variant="modal-title">
          Change your password
        </Heading>
        <Text variant="modal-body" tone="primary">
          Choose a new password to keep your account safe.
        </Text>
      </div>
      <div className="flex flex-col gap-4">
        <PasswordField label="Current Password" required placeholder="Enter your current password..." />
        <PasswordField label="New Password" required placeholder="Enter your new password..." />
        <PasswordField label="Confirm New Password" required placeholder="Confirm your new password..." error="Passwords do not match" />
      </div>
      <div className="flex items-center justify-end gap-6">
        <Button variant="text">Cancel</Button>
        <Button>Change Password</Button>
      </div>
    </div>
  ),
};
