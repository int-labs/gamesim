import { isOriginAllowed, parseAllowedOrigins } from "../utils/allowedOrigins";

describe("allowedOrigins", () => {
  it("includes player and admin local defaults", () => {
    const origins = parseAllowedOrigins({});
    expect(origins).toEqual(
      expect.arrayContaining([
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
      ]),
    );
  });

  it("merges CLIENT_ORIGIN, PLAYER_ORIGIN, ADMIN_ORIGIN, and ALLOWED_ORIGINS", () => {
    const origins = parseAllowedOrigins({
      CLIENT_ORIGIN: "https://player.example.com/",
      PLAYER_ORIGIN: "https://player.example.com",
      ADMIN_ORIGIN: "https://admin.example.com",
      ALLOWED_ORIGINS: "https://extra.example.com, https://other.example.com/",
    });
    expect(origins).toEqual(
      expect.arrayContaining([
        "https://player.example.com",
        "https://admin.example.com",
        "https://extra.example.com",
        "https://other.example.com",
      ]),
    );
  });

  it("is strict in prod-like mode and permissive in development", () => {
    const allowed = ["https://player.example.com"];
    expect(isOriginAllowed("https://player.example.com", allowed, true)).toBe(true);
    expect(isOriginAllowed("https://evil.example.com", allowed, true)).toBe(false);
    expect(isOriginAllowed("https://evil.example.com", allowed, false)).toBe(true);
    expect(isOriginAllowed(undefined, allowed, true)).toBe(true);
  });
});
