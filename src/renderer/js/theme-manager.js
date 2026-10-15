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
      root.setAttribute("data-accent-color", accentColor);
      root.setAttribute("data-theme-color", accentColor);
    } else {
      root.removeAttribute("data-accent");
      root.removeAttribute("data-accent-color");
      root.removeAttribute("data-theme-color");
    }

    this.syncBrandAssets(accentColor);

    // Dispara evento global para sincronização de componentes de interface
    window.dispatchEvent(
      new CustomEvent("themechange", { detail: { ...this.preferences } })
    );
  }

  /**
   * Contrato themeEngine:applyTheme(themeMode, themeColor)
   */
  applyTheme(themeMode, themeColor) {
    if (themeMode) {
      if (themeMode === "dark-amoled") {
        this.preferences.themeMode = "dark-amoled";
        this.preferences.darkVariant = "amoled";
      } else if (themeMode === "light") {
        this.preferences.themeMode = "light";
      } else {
        this.preferences.themeMode = "dark";
        this.preferences.darkVariant = "slate";
      }
    }
    if (themeColor !== undefined) {
      this.preferences.accentColor = themeColor || "default";
    }
    this.savePreferences();
    this.apply();
  }

  /**
   * Contrato themeEngine:syncBrandAssets(accentColor)
   */
  syncBrandAssets(accentColor) {
    const col = accentColor || this.preferences.accentColor;
    const root = document.documentElement;
    if (col && col !== "default") {
      root.style.setProperty("--brand-mark-primary", `var(--accent-${col}, var(--accent))`);
      root.style.setProperty("--brand-mark-secondary", `var(--accent-${col}-secondary, var(--video))`);
    } else {
      root.style.removeProperty("--brand-mark-primary");
      root.style.removeProperty("--brand-mark-secondary");
    }
  }

  setThemeMode(mode) {
    this.applyTheme(mode, undefined);
  }

  setAccentColor(color) {
    this.applyTheme(undefined, color);
  }

  getPreferences() {
    return { ...this.preferences };
  }
}

export const themeManager = new ThemeManager();
export const themeEngine = themeManager;

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
        root.setAttribute("data-accent-color", prefs.accentColor);
        root.setAttribute("data-theme-color", prefs.accentColor);
      }
    }
  } catch (_) {}
}
