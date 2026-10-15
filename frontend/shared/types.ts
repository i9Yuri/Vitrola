/**
 * MARÉ - ESQUEMA DE TIPOS COMPARTILHADOS (types.ts)
 */

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
