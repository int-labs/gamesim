import { act, render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { Avatar, initialsOf } from "./Avatar";

describe("initialsOf", () => {
  it("takes the first letters of the first and last words", () => {
    expect(initialsOf("Team Anakin")).toBe("TA");
    expect(initialsOf("Rido Hendrawan")).toBe("RH");
    expect(initialsOf("Gita Ayu Ningtyas")).toBe("GN");
    expect(initialsOf("ayu lestari")).toBe("AL");
    expect(initialsOf("Novabank")).toBe("N");
    expect(initialsOf("   ")).toBe("");
  });

  it("keeps whole characters and follows the locale's letter case", () => {
    expect(initialsOf("𝒜da Lovelace")).toBe("𝒜L");
    expect(initialsOf("ismail yılmaz", "tr")).toBe("İY");
  });

  it("skips what is not a letter, and a Thai vowel written before its consonant", () => {
    expect(initialsOf("สมชาย ใจดี")).toBe("สจ");
    expect(initialsOf("เก่ง ไทย")).toBe("กท");
    expect(initialsOf("(Team) Delta")).toBe("TD");
    expect(initialsOf("Team 7")).toBe("T7");
    expect(initialsOf("--")).toBe("-");
  });
});

describe("Avatar", () => {
  it("shows the initials on indigo without a picture, hidden from assistive technology by default", () => {
    const { container } = render(<Avatar name="Team Anakin" />);
    expect(screen.getByText("TA")).toHaveClass("bg-accent");
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("img")).toBeNull();
  });

  it("names its owner when nothing beside it does", () => {
    render(<Avatar name="Team Anakin" alt="Team Anakin" />);
    expect(screen.getByRole("img", { name: "Team Anakin" })).toBeInTheDocument();
  });

  it("gives a picture a moment to load before showing the initials", () => {
    vi.useFakeTimers();
    try {
      // jsdom loads no images, so the picture never arrives and the initials follow.
      render(<Avatar name="Team Anakin" src="https://example.com/team.png" />);
      expect(screen.queryByText("TA")).toBeNull();
      act(() => {
        vi.advanceTimersByTime(600);
      });
      expect(screen.getByText("TA")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("takes its size from the tokens", () => {
    const { container, rerender } = render(<Avatar name="Team Anakin" />);
    expect(container.firstElementChild).toHaveClass("size-(--avatar-size-lg)");
    rerender(<Avatar name="Team Anakin" size="sm" />);
    expect(container.firstElementChild).toHaveClass("size-(--avatar-size-sm)");
  });
});
