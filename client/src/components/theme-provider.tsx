import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "il-theme";

type ThemeContextValue = {
  theme: Theme;
  resolved: "light" | "dark";
  setTheme: (t: Theme) => void;
  cycle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function systemTheme(): "light" | "dark" {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(resolved: "light" | "dark") {
  document.documentElement.classList.toggle("dark", resolved === "dark");
  document.documentElement.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    return stored ?? "light";
  });
  const [resolved, setResolved] = useState<"light" | "dark">(() =>
    (localStorage.getItem(STORAGE_KEY) as Theme | null) === "dark"
      ? "dark"
      : (localStorage.getItem(STORAGE_KEY) as Theme | null) === "system"
        ? systemTheme()
        : "light"
  );

  useEffect(() => {
    const next = theme === "system" ? systemTheme() : theme;
    setResolved(next);
    apply(next);
    localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  // Follow the OS only while in "system" mode.
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      const next = systemTheme();
      setResolved(next);
      apply(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => setThemeState(t), []);
  const cycle = useCallback(
    () => setThemeState((t) => (t === "light" ? "dark" : t === "dark" ? "system" : "light")),
    []
  );

  const value = useMemo(
    () => ({ theme, resolved, setTheme, cycle }),
    [theme, resolved, setTheme, cycle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>");
  return ctx;
}
