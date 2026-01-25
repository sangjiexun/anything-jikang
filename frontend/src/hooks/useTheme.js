import { REFETCH_LOGO_EVENT } from "@/LogoContext";
import { useState, useEffect } from "react";

const availableThemes = {
  "jikang-gold": "极康金",
  default: "默认深色",
  light: "默认浅色",
  qingshan: "见青山",
  shuihanyan: "水含烟",
};

// 浅色主题列表，用于添加 light class
const lightThemes = ["light", "shuihanyan"];

/**
 * Determines the current theme of the application
 * @returns {{theme: string, setTheme: function, availableThemes: object}} The current theme, a function to set the theme, and the available themes
 */
export function useTheme() {
  const [theme, _setTheme] = useState(() => {
    return localStorage.getItem("theme") || "jikang-gold";
  });

  useEffect(() => {
    if (localStorage.getItem("theme") !== null) return;
    if (!window.matchMedia) return;
    if (window.matchMedia("(prefers-color-scheme: light)").matches)
      return _setTheme("shuihanyan");
    _setTheme("jikang-gold");
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    // 为浅色主题添加 light class
    document.body.classList.toggle("light", lightThemes.includes(theme));
    localStorage.setItem("theme", theme);
    window.dispatchEvent(new Event(REFETCH_LOGO_EVENT));
  }, [theme]);

  // In development, attach keybind combinations to cycle through themes
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const themeKeys = Object.keys(availableThemes);
    function toggleOnKeybind(e) {
      if (e.metaKey && e.key === ".") {
        e.preventDefault();
        setTheme((prev) => {
          const currentIndex = themeKeys.indexOf(prev);
          const nextIndex = (currentIndex + 1) % themeKeys.length;
          return themeKeys[nextIndex];
        });
      }
    }
    document.addEventListener("keydown", toggleOnKeybind);
    return () => document.removeEventListener("keydown", toggleOnKeybind);
  }, []);

  /**
   * Sets the theme of the application and runs any
   * other necessary side effects
   * @param {string} newTheme The new theme to set
   */
  function setTheme(newTheme) {
    _setTheme(newTheme);
  }

  return { theme, setTheme, availableThemes };
}
