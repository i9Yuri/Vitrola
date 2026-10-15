/**
 * VITROLA - ESQUEMA DE TIPOS COMPARTILHADOS (types.ts)
 */

export interface HistoryRecord {
  id: string;
  mediaKey: string;
  title: string;
  artist?: string;
  format: string;
  quality: string;
  sizeBytes: number;
  filePath: string;
  completedAt: string;
  downloadCount: number;
}

export interface HistoryItem {
  id: string;
  mediaKey: string;
  title: string;
  artist?: string;
  format: string;
  quality: string;
  sizeBytes?: number;
  size?: string;
  total_size?: string;
  filePath?: string;
  filepath?: string;
  filename?: string;
  completedAt: string;
  completed_at?: string;
  downloadCount: number;
  download_count?: number;
}

export interface AggregatedHistoryRecord {
  mediaKey: string;
  title: string;
  artist?: string;
  format: string;
  quality?: string;
  sizeBytes?: number;
  total_size?: string;
  filePath?: string;
  filepath?: string;
  filename?: string;
  completedAt: string;
  completed_at?: string;
  downloadCount: number;
  rawItems?: HistoryItem[];
}

export interface WindowActionResult {
  success: boolean;
  isMaximized?: boolean;
  action?: string;
  error?: string;
}

export interface FileCheckResult {
  exists: boolean;
  opened?: string;
  error?: string;
}

export interface DirectorySelectResult {
  canceled: boolean;
  path?: string;
  selectedPath?: string;
  error?: string;
}

export interface ThemeSurfaces {
  desk: string;
  win: string;
  surface: string;
  raised: string;
}

export interface ThemePaletteDefinition {
  id: string;
  name: string;
  hue: number;
  accent: string;
  accentSoft: string;
  darkSurfaces: ThemeSurfaces;
  lightSurfaces: ThemeSurfaces;
  amoledSurfaces: ThemeSurfaces;
}

export type ThemeMode = 'dark' | 'light' | 'dark-amoled';
