import { cn } from "./cn";

describe("cn", () => {
  it("joins strings, arrays and conditional objects", () => {
    const hidden = false;
    expect(cn("p-4", ["m-2", hidden && "hidden"], { "text-center": true, underline: false })).toBe("p-4 m-2 text-center");
  });

  it("lets a later token class win over an earlier one on the same scale", () => {
    expect(cn("shadow-sm", "shadow-card")).toBe("shadow-card");
    expect(cn("shadow-card", "shadow-thumb")).toBe("shadow-thumb");
    expect(cn("drop-shadow-glow", "drop-shadow-glow-strong")).toBe("drop-shadow-glow-strong");
    expect(cn("inset-shadow-glass", "inset-shadow-highlight")).toBe("inset-shadow-highlight");
    expect(cn("rounded-lg", "rounded-4xl")).toBe("rounded-4xl");
    expect(cn("blur-md", "blur-overlay")).toBe("blur-overlay");
    expect(cn("ease-standard", "ease-pop")).toBe("ease-pop");
    expect(cn("leading-normal", "leading-display")).toBe("leading-display");
    expect(cn("tracking-normal", "tracking-none")).toBe("tracking-none");
    expect(cn("z-dropdown", "z-modal")).toBe("z-modal");
    expect(cn("duration-fast", "duration-shake")).toBe("duration-shake");
    expect(cn("bg-gradient-sheen", "bg-gradient-wordmark")).toBe("bg-gradient-wordmark");
    expect(cn("font-body", "font-display")).toBe("font-display");
  });

  it("keeps classes that set different properties", () => {
    expect(cn("bg-primary", "bg-gradient-sheen")).toBe("bg-primary bg-gradient-sheen");
    expect(cn("text-md", "text-fg-muted")).toBe("text-md text-fg-muted");
    expect(cn("shadow-card", "inset-shadow-glass")).toBe("shadow-card inset-shadow-glass");
  });

  it("tells font sizes from text colours", () => {
    expect(cn("text-2xs", "text-md")).toBe("text-md");
    expect(cn("text-fg-body", "text-fg-primary")).toBe("text-fg-primary");
  });

  it("lets a text role replace earlier font classes, and later font classes refine a role", () => {
    expect(cn("text-lg font-bold tracking-wide", "type-body")).toBe("type-body");
    expect(cn("leading-none", "type-body")).toBe("type-body");
    expect(cn("type-body", "type-label")).toBe("type-label");
    expect(cn("type-body", "font-semibold")).toBe("type-body font-semibold");
    expect(cn("type-body", "text-fg-muted")).toBe("type-body text-fg-muted");
  });
});
