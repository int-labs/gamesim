import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { vi } from "vitest";
import { TextArea } from "./TextArea";

/** The ids a control is described by, as the elements they name. */
function descriptionsOf(control: HTMLElement) {
  return (control.getAttribute("aria-describedby") ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((id) => document.getElementById(id));
}

describe("TextArea", () => {
  it("is a labelled text box of several lines, its help read with it", () => {
    render(<TextArea label="Round notes" description="Shown in the debrief." />);
    const box = screen.getByRole("textbox", { name: "Round notes" });
    expect(box.tagName).toBe("TEXTAREA");
    expect(box).toHaveAttribute("rows", "4");
    expect(box).toHaveAccessibleDescription("Shown in the debrief.");
  });

  it("marks a required field, and says what is wrong with it", () => {
    render(<TextArea label="Debrief" required error="Write a few words for the teams." />);
    const box = screen.getByRole("textbox", { name: /Debrief/ });
    expect(box).toBeRequired();
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("*")).toHaveAttribute("aria-hidden");
    expect(descriptionsOf(box).map((node) => node?.textContent)).toContain("Write a few words for the teams.");
  });

  it("starts a new line with Enter", async () => {
    const onSubmit = vi.fn((event: SubmitEvent) => event.preventDefault());
    render(
      <form onSubmit={(event) => onSubmit(event.nativeEvent as SubmitEvent)}>
        <TextArea label="Round notes" />
      </form>,
    );
    const box = screen.getByRole("textbox", { name: "Round notes" });
    await userEvent.type(box, "First line{Enter}Second line");
    expect(box).toHaveValue("First line\nSecond line");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("counts what is typed against its limit, and stops at it", async () => {
    render(<TextArea label="Round notes" maxLength={12} />);
    const box = screen.getByRole("textbox", { name: "Round notes" });
    expect(screen.getByText("0/12")).toBeInTheDocument();
    // A screen reader hears the count in words, with the field, and not the figures seen.
    expect(box).toHaveAccessibleDescription("0 of 12 characters");
    await userEvent.type(box, "Hello");
    expect(screen.getByText("5/12")).toBeInTheDocument();
    await userEvent.type(box, " there, all of you");
    expect(box).toHaveValue("Hello there,");
    const count = screen.getByText("12/12");
    // Full: the count says why nothing more goes in.
    expect(count.parentElement?.className).toContain("text-fg-warning");
  });

  it("writes the count with the app's grouping, and in the app's words", () => {
    render(
      <TextArea
        label="Catatan"
        maxLength={5000}
        defaultValue="Halo"
        messages={{ count: (length, max) => `${length} dari ${max} karakter` }}
      />,
    );
    expect(screen.getByText("4/5,000")).toBeInTheDocument();
    expect(screen.getByText("4 dari 5,000 karakter")).toHaveClass("sr-only");
  });

  it("counts a controlled value as it changes", async () => {
    function Controlled() {
      const [notes, setNotes] = useState("Draft");
      return <TextArea label="Round notes" maxLength={100} value={notes} onChange={(event) => setNotes(event.target.value.toUpperCase())} />;
    }
    render(<Controlled />);
    expect(screen.getByText("5/100")).toBeInTheDocument();
    await userEvent.type(screen.getByRole("textbox", { name: "Round notes" }), "s");
    expect(screen.getByRole("textbox", { name: "Round notes" })).toHaveValue("DRAFTS");
    expect(screen.getByText("6/100")).toBeInTheDocument();
  });

  it("shows no count without a limit, or when asked not to", () => {
    const { rerender } = render(<TextArea label="Round notes" />);
    expect(screen.queryByText(/\/\d/)).toBeNull();
    rerender(<TextArea label="Round notes" maxLength={50} showCount={false} />);
    expect(screen.queryByText("0/50")).toBeNull();
  });

  it("can't be typed in while disabled", async () => {
    render(<TextArea label="Round notes" disabled defaultValue="Locked" />);
    const box = screen.getByRole("textbox", { name: "Round notes" });
    expect(box).toBeDisabled();
    await userEvent.type(box, " more");
    expect(box).toHaveValue("Locked");
  });

  it("hands its ref and every textarea prop to the textarea", () => {
    const ref = { current: null as HTMLTextAreaElement | null };
    render(<TextArea ref={ref} label="Round notes" name="notes" placeholder="What happened this round?" spellCheck={false} />);
    const box = screen.getByRole("textbox", { name: "Round notes" });
    expect(ref.current).toBe(box);
    expect(box).toHaveAttribute("name", "notes");
    expect(box).toHaveAttribute("placeholder", "What happened this round?");
    expect(box).toHaveAttribute("spellcheck", "false");
  });

  it("keeps its measuring copy away from assistive technology and the keyboard", () => {
    const { container } = render(<TextArea label="Round notes" />);
    const areas = container.querySelectorAll("textarea");
    expect(areas).toHaveLength(2);
    const copy = areas[1] as HTMLTextAreaElement;
    expect(copy).toHaveAttribute("aria-hidden", "true");
    expect(copy).toHaveAttribute("tabindex", "-1");
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
  });
});
