import { useTheme as useNextTheme } from "next-themes";

export function useTheme() {
  const { theme, setTheme, resolvedTheme } = useNextTheme();
  const isDark = resolvedTheme === "dark";
  return {
    theme,
    isDark,
    toggle: () => setTheme(isDark ? "light" : "dark"),
  };
}
