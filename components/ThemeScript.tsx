"use client";

import { useEffect } from "react";

export default function ThemeScript() {
  useEffect(() => {
    try {
      const saved = localStorage.getItem("phyzic_theme");
      const prefersDark =
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      const theme = saved || (prefersDark ? "dark" : "light");
      document.documentElement.setAttribute("data-theme", theme);
    } catch {}
  }, []);

  return null;
}
