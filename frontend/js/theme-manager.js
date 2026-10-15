/**
 * VITROLA - MOTOR DE TEMAS (theme-manager.js)
 * Gerencia Modos de Superfície (Claro, Slate, AMOLED) e Acentos Dinâmicos.
 */

const STORAGE_KEY = "vitrola_settings";

const DEFAULT_PREFERENCES = {
  themeMode: "dark", // "dark" | "light" | "dark-amoled"
  darkVariant: "slate", // "slate" | "amoled"
  accentColor: "default", // "default" | "amber" | "violet" | "emerald" | "rose" | "cyan"
};

class ThemeManager {
  constructor() {
    this.preferences = this.loadPreferences();
  }

  loadPreferences() {
    try {
      // Migração de chaves legadas
      const legacyKeys = ["user_theme_preferences", "mediaforge_settings", "mediaforge_config", "mare_settings", "mare_config"];
      let legacyData = null;
      for (const k of legacyKeys) {
        const item = localStorage.getItem(k);
        if (item && !legacyData) {
          try { legacyData = JSON.parse(item); } catch (_) {}
        }
        localStorage.removeItem(k); // expurgar chaves legadas
      }

      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        return { ...DEFAULT_PREFERENCES, ...JSON.parse(saved) };
      }
      if (legacyData) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(legacyData));
        return { ...DEFAULT_PREFERENCES, ...legacyData };
      }
    } catch (e) {
      console.warn("[ThemeManager] Erro ao ler preferências:", e);
    }
    return { ...DEFAULT_PREFERENCES };
  }

  savePreferences() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.preferences));
    } catch (e) {
      console.warn("[ThemeManager] Erro ao salvar preferências:", e);
    }
  }

  apply() {
    const root = document.documentElement;
    const { themeMode, darkVariant, accentColor } = this.preferences;

    if (themeMode === "dark-amoled" || (themeMode === "dark" && darkVariant === "amoled")) {
      root.setAttribute("data-theme", "dark-amoled");
      root.setAttribute("data-dark-variant", "amoled");
    } else if (themeMode === "light") {
      root.setAttribute("data-theme", "light");
      root.removeAttribute("data-dark-variant");
    } else {
      root.setAttribute("data-theme", "dark");
      root.setAttribute("data-dark-variant", "slate");
    }

    if (accentColor && accentColor !== "default") {
      root.setAttribute("data-accent", accentColor);
    } else {
      root.removeAttribute("data-accent");
    }

    // Dispara evento global para sincronização de componentes de interface
    window.dispatchEvent(
      new CustomEvent("themechange", { detail: { ...this.preferences } })
    );
  }

  setThemeMode(mode) {
    if (mode === "dark-amoled") {
      this.preferences.themeMode = "dark-amoled";
      this.preferences.darkVariant = "amoled";
    } else if (mode === "light") {
      this.preferences.themeMode = "light";
    } else {
      this.preferences.themeMode = "dark";
      this.preferences.darkVariant = "slate";
    }
    this.savePreferences();
    this.apply();
  }

  setAccentColor(color) {
    this.preferences.accentColor = color || "default";
    this.savePreferences();
    this.apply();
  }

  getPreferences() {
    return { ...this.preferences };
  }
}

export const themeManager = new ThemeManager();

/**
 * Script síncrono para execução imediata no <head> evitando FOUC (Flash of Unstyled Content)
 */
export function injectEarlyThemeBootstrap() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const prefs = JSON.parse(saved);
      const root = document.documentElement;
      if (prefs.themeMode === "dark-amoled" || prefs.darkVariant === "amoled") {
        root.setAttribute("data-theme", "dark-amoled");
        root.setAttribute("data-dark-variant", "amoled");
      } else if (prefs.themeMode === "light") {
        root.setAttribute("data-theme", "light");
      } else {
        root.setAttribute("data-theme", "dark");
        root.setAttribute("data-dark-variant", "slate");
      }
      if (prefs.accentColor && prefs.accentColor !== "default") {
        root.setAttribute("data-accent", prefs.accentColor);
      }
    }
  } catch (_) {}
}
