/**
 * VITROLA - METADADOS GLOBAIS E CONSTANTES DO SISTEMA
 */

export const APP_CONFIG = {
  NAME: 'Vitrola',
  SLUG: 'vitrola',
  REPOSITORY: 'https://github.com/i9Yuri/Vitrola',
  DEFAULT_DOWNLOAD_DIR: 'Vitrola',
  STORAGE_KEYS: {
    SETTINGS: 'vitrola_settings',
    HISTORY: 'vitrola_history'
  },
  VERSION: '2.4.0'
};

export const APP_METADATA = {
  NAME: APP_CONFIG.NAME,
  SLUG: APP_CONFIG.SLUG,
  REPO_URL: APP_CONFIG.REPOSITORY,
  DEFAULT_FOLDER_NAME: APP_CONFIG.DEFAULT_DOWNLOAD_DIR,
  VERSION: APP_CONFIG.VERSION
};

/**
 * Matrizes Cromáticas Padrão do Sistema de Temas
 * Suporte a: Âmbar, Violeta, Esmeralda, Carmim e Ciano
 */
export const THEME_PALETTES = {
  amber: {
    id: 'amber',
    name: 'Âmbar',
    hue: 38,
    accent: '#FFB547',
    accentSoft: 'rgba(255, 181, 71, 0.14)',
    darkSurfaces: { desk: '#282520', win: '#1c1a17', surface: '#25221d', raised: '#332f28' },
    lightSurfaces: { desk: '#edeae4', win: '#faf8f5', surface: '#f1ede4', raised: '#e6dfd3' },
    amoledSurfaces: { desk: '#000000', win: '#000000', surface: '#050505', raised: '#1f1b13' }
  },
  violet: {
    id: 'violet',
    name: 'Violeta',
    hue: 236,
    accent: '#8E96FF',
    accentSoft: 'rgba(142, 150, 255, 0.16)',
    darkSurfaces: { desk: '#22242e', win: '#161821', surface: '#1d202b', raised: '#282c3c' },
    lightSurfaces: { desk: '#eaebee', win: '#f7f8fc', surface: '#eceef5', raised: '#dde1ee' },
    amoledSurfaces: { desk: '#000000', win: '#000000', surface: '#050505', raised: '#141521' }
  },
  emerald: {
    id: 'emerald',
    name: 'Esmeralda',
    hue: 160,
    accent: '#10B981',
    accentSoft: 'rgba(16, 185, 129, 0.15)',
    darkSurfaces: { desk: '#202624', win: '#161d1a', surface: '#1d2521', raised: '#26332c' },
    lightSurfaces: { desk: '#e8ecea', win: '#f6f9f7', surface: '#ebf1ee', raised: '#dbe5e0' },
    amoledSurfaces: { desk: '#000000', win: '#000000', surface: '#050505', raised: '#14211a' }
  },
  rose: {
    id: 'rose',
    name: 'Carmim',
    hue: 348,
    accent: '#F43F5E',
    accentSoft: 'rgba(244, 63, 94, 0.15)',
    darkSurfaces: { desk: '#272022', win: '#1e1517', surface: '#261c1e', raised: '#352629' },
    lightSurfaces: { desk: '#ece8e9', win: '#faf6f7', surface: '#f2eaec', raised: '#e7dbe0' },
    amoledSurfaces: { desk: '#000000', win: '#000000', surface: '#050505', raised: '#211316' }
  },
  cyan: {
    id: 'cyan',
    name: 'Ciano',
    hue: 189,
    accent: '#06B6D4',
    accentSoft: 'rgba(6, 182, 212, 0.15)',
    darkSurfaces: { desk: '#1f2527', win: '#151b1e', surface: '#1b2327', raised: '#243036' },
    lightSurfaces: { desk: '#e8ebec', win: '#f5f9fa', surface: '#eaf1f3', raised: '#d9e4e7' },
    amoledSurfaces: { desk: '#000000', win: '#000000', surface: '#050505', raised: '#121e23' }
  }
};
