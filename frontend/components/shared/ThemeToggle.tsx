"use client";

import { useTheme } from "./ThemeProvider";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="btn-ghost"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 36,
        height: 36,
        padding: 0,
        borderRadius: "var(--radius-sm)",
        cursor: "pointer",
        transition: "all var(--dur-fast) var(--ease-spring)",
      }}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
      title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
    >
      {theme === "dark" ? (
        <Sun size={16} style={{ opacity: 0.7 }} />
      ) : (
        <Moon size={16} style={{ opacity: 0.7 }} />
      )}
    </button>
  );
}
