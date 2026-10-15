/**
 * FITA / MEDIAFORGE - CONTRATOS DE TIPAGEM E COMUNICAÇÃO IPC / HTTP
 */

export interface MediaMetadata {
  id: string;
  title: string;
  uploader: string;
  duration: number;
  durationFormatted: string;
  thumbnail: string;
  viewCount: number;
  availableFormats: {
    audio: Array<{ formatId: string; ext: 'mp3' | 'm4a' | 'opus' | 'flac'; bitrate: number }>;
    video: Array<{ formatId: string; ext: 'mp4' | 'webm' | 'mkv'; resolution: string; approxSize: number }>;
  };
}

export interface DownloadPayload {
  url: string;
  mediaType: 'audio' | 'video';
  format: string;
  quality: string;
  embedThumbnail: boolean;
  embedSubtitles: boolean;
  outputDirectory?: string;
}

export interface YtDlpStatus {
  version: string;
  latestVersion?: string;
  isUpToDate: boolean;
  lastChecked: string;
}

export interface YtDlpUpdateResponse {
  success: boolean;
  newVersion?: string;
  error?: string;
  outputLog?: string;
}
