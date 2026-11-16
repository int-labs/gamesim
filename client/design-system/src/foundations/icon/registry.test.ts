import * as lucide from "lucide-react";
import { iconNames, iconRegistry, renamedIcons, resolveIcon } from "./registry";

// The names the four clients' utils/lucideIconMap.ts offered, as configuration stores them.
const LEGACY_CONFIG_NAMES = [
  "Banknote", "Briefcase", "Building", "Building2", "Car", "ChartBar", "CircleDollarSign", "CreditCard",
  "Factory", "Globe", "GraduationCap", "HandCoins", "HeartHandshake", "HeartPulse", "Home", "Hotel",
  "Landmark", "Layers", "LayoutGrid", "Leaf", "MapPin", "Megaphone", "Monitor", "Package", "PaintBucket",
  "Palette", "Plane", "Rocket", "Shield", "ShoppingBag", "ShoppingCart", "Smartphone", "Sparkles", "Star",
  "Store", "Tag", "Target", "Truck", "User", "Users", "Utensils", "Wallet", "Wrench", "Zap",
];

function pascal(kebab: string): string {
  return kebab.replace(/(^|-)([a-z0-9])/g, (_, _dash: string, char: string) => char.toUpperCase());
}

describe("resolveIcon", () => {
  it("resolves every name today's configuration can hold", () => {
    expect(LEGACY_CONFIG_NAMES).toHaveLength(44);
    for (const name of LEGACY_CONFIG_NAMES) {
      const icon = resolveIcon(name);
      expect(icon, name).toBeDefined();
      // The same glyph the clients render today (Home is an alias of House).
      expect(icon, name).toBe((lucide as unknown as Record<string, unknown>)[name]);
    }
  });

  it("accepts lucide names, PascalCase names and renamed old names", () => {
    expect(resolveIcon("building-2")).toBe(lucide.Building2);
    expect(resolveIcon("Building2")).toBe(lucide.Building2);
    expect(resolveIcon("building2")).toBe(lucide.Building2);
    expect(resolveIcon(" ShoppingBag ")).toBe(lucide.ShoppingBag);
    expect(resolveIcon("home")).toBe(lucide.House);
  });

  it("returns undefined for unknown or empty names", () => {
    expect(resolveIcon("not-an-icon")).toBeUndefined();
    expect(resolveIcon("")).toBeUndefined();
    expect(resolveIcon(null)).toBeUndefined();
    expect(resolveIcon(undefined)).toBeUndefined();
    expect(resolveIcon("constructor")).toBeUndefined();
    expect(resolveIcon("toString")).toBeUndefined();
  });
});

describe("the registry", () => {
  it("keys each icon by its lucide name", () => {
    for (const [name, icon] of Object.entries(iconRegistry)) {
      expect(icon, name).toBe((lucide as unknown as Record<string, unknown>)[pascal(name)]);
    }
  });

  it("lists its names sorted", () => {
    expect(iconNames).toEqual([...Object.keys(iconRegistry)].sort());
  });

  it("maps every renamed Figma slug to an icon lucide still has", () => {
    for (const [oldName, current] of Object.entries(renamedIcons)) {
      expect((lucide as unknown as Record<string, unknown>)[pascal(current)], `${oldName} -> ${current}`).toBeDefined();
    }
  });
});
