import { Monitor, Moon, Sun } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useTheme } from "@/components/theme-provider";
import { IconButton } from "@/components/ui/icon-button";

/** M22 ThemeToggle — cycles light → dark → system (spec §4.3 #43). */
export function ThemeToggle({ onDark = false }: { onDark?: boolean }) {
  const { theme, cycle } = useTheme();
  const Icon = theme === "light" ? Sun : theme === "dark" ? Moon : Monitor;
  const label =
    theme === "light" ? "Theme: light" : theme === "dark" ? "Theme: dark" : "Theme: follows system";

  return (
    <IconButton label={label} variant={onDark ? "onDark" : "ghost"} onClick={cycle}>
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -90, scale: 0.7 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.7 }}
          transition={{ duration: 0.25 }}
          className="flex items-center justify-center"
        >
          <Icon />
        </motion.span>
      </AnimatePresence>
    </IconButton>
  );
}
