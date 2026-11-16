import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { createRef, type ChangeEvent } from "react";
import { vi } from "vitest";
import { Input } from "../input/Input";
import { PasswordField, TextField } from "./TextField";

describe("TextField", () => {
  it("labels its input and marks it required", () => {
    render(<TextField label="Current Password" required />);
    // The accessible name leaves the hidden asterisk out.
    const input = screen.getByRole("textbox", { name: "Current Password" });
    expect(input).toBeRequired();
    // The asterisk is visual only: assistive technology reads "required" from the input.
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden");
  });

  it("links its help text to the input", () => {
    render(<TextField label="Email" description="We never share it." />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAccessibleDescription("We never share it.");
  });

  it("shows an error, marks the input invalid and links the message", () => {
    render(<TextField label="Email" error="Please enter a valid email address" />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Please enter a valid email address");
    expect(screen.getByText("Please enter a valid email address")).toBeVisible();
  });

  it("is valid when the error is empty", () => {
    render(<TextField label="Email" error="" />);
    expect(screen.getByLabelText("Email")).not.toHaveAttribute("aria-invalid", "true");
  });

  it("works with a form library's register(): name, change, blur and ref reach the input", async () => {
    const onChange = vi.fn((event: ChangeEvent<HTMLInputElement>) => event.target.value);
    const onBlur = vi.fn();
    const ref = createRef<HTMLInputElement>();
    render(<TextField label="Email" name="email" onChange={onChange} onBlur={onBlur} ref={ref} />);
    const input = screen.getByLabelText("Email");
    expect(input).toHaveAttribute("name", "email");
    expect(ref.current).toBe(input);
    await userEvent.type(input, "a@b.co");
    expect(onChange).toHaveBeenCalledTimes(6);
    expect(onChange.mock.results.at(-1)?.value).toBe("a@b.co");
    await userEvent.tab();
    expect(onBlur).toHaveBeenCalledOnce();
  });

  it("disables the input", () => {
    render(<TextField label="Email" disabled />);
    expect(screen.getByLabelText("Email")).toBeDisabled();
  });
});

describe("PasswordField", () => {
  it("hides the password until the eye is pressed, and says so", async () => {
    render(<PasswordField label="Password" />);
    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");

    const eye = screen.getByRole("button", { name: "Show password" });
    expect(eye).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(eye);
    expect(input).toHaveAttribute("type", "text");
    const hide = screen.getByRole("button", { name: "Hide password" });
    expect(hide).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(hide);
    expect(input).toHaveAttribute("type", "password");
  });

  it("takes translated labels", () => {
    render(<PasswordField label="Kata sandi" showLabel="Tampilkan kata sandi" />);
    expect(screen.getByRole("button", { name: "Tampilkan kata sandi" })).toBeInTheDocument();
  });
});

describe("Input", () => {
  it("can be marked invalid on its own", () => {
    render(<Input aria-label="Search" invalid />);
    expect(screen.getByRole("textbox", { name: "Search" })).toHaveAttribute("aria-invalid", "true");
  });

  it("uses the Figma heights: 46 by default, 42 and 38 when asked", () => {
    const { container } = render(
      <>
        <Input aria-label="a" />
        <Input aria-label="b" size="md" />
        <Input aria-label="c" size="sm" />
      </>,
    );
    const wrappers = [...container.children];
    expect(wrappers[0]?.className).toContain("h-(--input-height-lg)");
    expect(wrappers[1]?.className).toContain("h-(--input-height-md)");
    expect(wrappers[2]?.className).toContain("h-(--input-height-sm)");
  });
});
