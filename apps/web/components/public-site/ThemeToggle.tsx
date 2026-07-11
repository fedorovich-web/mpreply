"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const THEME_EVENT = "respio-themechange";

function readTheme(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribeTheme(callback: () => void) {
  window.addEventListener(THEME_EVENT, callback);
  return () => window.removeEventListener(THEME_EVENT, callback);
}

export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribeTheme, readTheme, () => "light");
  const nextTheme: Theme = theme === "light" ? "dark" : "light";
  const label = nextTheme === "dark" ? "Включить тёмную тему" : "Включить светлую тему";

  const toggleTheme = () => {
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("respio-theme", nextTheme);
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      aria-pressed={theme === "dark"}
      title={label}
    >
      <span className="theme-toggle-track" aria-hidden="true">
        <span className="theme-toggle-thumb">
          <svg className="theme-toggle-icon theme-toggle-icon-sun" viewBox="0 0 24 24" focusable="false">
            <path d="M12 3v2.2M12 18.8V21M3 12h2.2M18.8 12H21M5.64 5.64 7.2 7.2M16.8 16.8l1.56 1.56M18.36 5.64 16.8 7.2M7.2 16.8l-1.56 1.56" />
            <circle cx="12" cy="12" r="4" />
          </svg>
          <svg className="theme-toggle-icon theme-toggle-icon-moon" viewBox="0 0 24 24" focusable="false">
            <path d="M20 15.1A8.2 8.2 0 0 1 8.9 4a8.2 8.2 0 1 0 11.1 11.1Z" />
          </svg>
        </span>
      </span>
    </button>
  );
}
