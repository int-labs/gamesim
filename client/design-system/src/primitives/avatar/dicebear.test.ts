import { avatarBackgrounds, avatarBackgroundsOf, avatarColours, avatarParts, avatarUrl, loadAvatarStyle, parseAvatarUrl, renderAvatar } from "./dicebear";

describe("DiceBear addresses", () => {
  it("writes the address a team keeps: DiceBear 10's form, choices in a fixed order, spaces as %20", () => {
    expect(avatarUrl({ style: "adventurer", seed: "Team Anakin", choices: { hairVariant: "long01", backgroundColor: "b6e3f4" } })).toBe(
      "https://api.dicebear.com/10.x/adventurer/svg?seed=Team%20Anakin&backgroundColor=b6e3f4&hairVariant=long01",
    );
  });

  it("reads a DiceBear 10 address back, choices included", () => {
    const recipe = { style: "lorelei" as const, seed: "Team Beta", choices: { eyesVariant: "variant03", glassesProbability: "0", hairColor: "0e0e0e" } };
    expect(parseAvatarUrl(avatarUrl(recipe))).toEqual(recipe);
  });

  it("reads today's fallback (DiceBear 9) as its style and seed: its option names differ", () => {
    expect(
      parseAvatarUrl(
        "https://api.dicebear.com/9.x/thumbs/svg?seed=Team Anakin&backgroundColor=b6e3f4,c0aede,d1d4f9&backgroundType=solid,gradientLinear",
      ),
    ).toEqual({ style: "thumbs", seed: "Team Anakin", choices: {} });
  });

  it("ignores anything that is not a DiceBear address of an offered style", () => {
    expect(parseAvatarUrl("https://res.cloudinary.com/demo/image/upload/team.png")).toBeNull();
    expect(parseAvatarUrl("https://api.dicebear.com/10.x/identicon/svg?seed=x")).toBeNull();
    expect(parseAvatarUrl("not an address")).toBeNull();
    expect(parseAvatarUrl(null)).toBeNull();
  });
});

describe("a style's choices", () => {
  it("lists the parts with more than one variant, optional ones marked", async () => {
    const parts = avatarParts(await loadAvatarStyle("adventurer"));
    const byKey = Object.fromEntries(parts.map((part) => [part.key, part]));
    expect(byKey.hair?.variants).toHaveLength(45);
    expect(byKey.glasses?.optional).toBe(true);
    expect(byKey.eyes?.optional).toBe(false);
    // The head has one variant: nothing to choose.
    expect(byKey.head).toBeUndefined();
  });

  it("lists the colours with a palette of more than one, without #", async () => {
    const colours = avatarColours(await loadAvatarStyle("adventurer"));
    const byKey = Object.fromEntries(colours.map((colour) => [colour.key, colour.values]));
    expect(byKey.skin).toEqual(["f2d3b1", "ecad80", "9e5622", "763900"]);
    expect(byKey.hair).toHaveLength(14);
    expect(byKey.eyes).toBeUndefined();
  });

  it("offers a style's own backgrounds first, and None only where it has none", async () => {
    const thumbs = avatarBackgroundsOf(await loadAvatarStyle("thumbs"));
    expect(thumbs.none).toBe(false);
    expect(thumbs.values.slice(0, 2)).toEqual(["0a5b83", "1c799f"]);
    expect(avatarColours(await loadAvatarStyle("thumbs")).some((colour) => colour.key === "background")).toBe(false);
    expect(avatarBackgroundsOf(await loadAvatarStyle("adventurer"))).toEqual({ values: [...avatarBackgrounds], none: true });
  });
});

describe("drawing", () => {
  it("draws an avatar here, and a choice changes it", async () => {
    const definition = await loadAvatarStyle("adventurer");
    const recipe = { style: "adventurer" as const, seed: "Team Anakin", choices: {} };
    const plain = renderAvatar(definition, recipe);
    expect(plain.startsWith("data:image/svg+xml")).toBe(true);
    expect(renderAvatar(definition, recipe)).toBe(plain);
    expect(renderAvatar(definition, recipe, { hairVariant: "short01" })).not.toBe(renderAvatar(definition, recipe, { hairVariant: "long01" }));
  });
});
