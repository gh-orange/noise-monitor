import { useState, useEffect } from "react";

export function useTheme() {
  const [themeMode, setThemeMode] = useState(() => {
    const savedMode = localStorage.getItem("themeMode");
    return savedMode || "auto";
  });

  const [systemTheme, setSystemTheme] = useState(() => {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  const actualTheme = themeMode === "auto" ? systemTheme : themeMode;

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", actualTheme);
    localStorage.setItem("themeMode", themeMode);
  }, [actualTheme, themeMode]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, []);

  return { themeMode, actualTheme, setThemeMode };
}