/**
 * VITROLA - MANIPULADOR DE HISTÓRICO (history-handler.js)
 * Agrupamento inteligente, deduplicação de tags, expurgo e deleção granular.
 */

export function sanitizeMetadataString(val, fallback = "") {
  if (val === null || val === undefined) return fallback;
  const str = String(val).trim();
  if (/^(na|n\/a|none|null|undefined)$/i.test(str) || str === "") {
    return fallback;
  }
  return str;
}

export function aggregateHistory(items = []) {
  if (!Array.isArray(items)) return [];

  const map = new Map();

  for (const item of items) {
    if (!item) continue;

    const rawTitle = sanitizeMetadataString(item.title, "Mídia sem título");
    const rawFormat = sanitizeMetadataString(item.format, item.mode || "audio").toLowerCase();
    const mediaKey =
      sanitizeMetadataString(item.media_key || item.mediaKey) ||
      `${rawTitle.toLowerCase()}_${rawFormat}`;

    const count = parseInt(item.download_count || item.downloadCount || 1, 10) || 1;
    const completedAt = item.completed_at || item.completedAt || item.timestamp;
    const totalSize = sanitizeMetadataString(item.total_size || item.size, "Concluído");
    const filePath = sanitizeMetadataString(item.filepath || item.filePath, "");
    const fileName = sanitizeMetadataString(item.filename || item.fileName, rawTitle);

    if (map.has(mediaKey)) {
      const existing = map.get(mediaKey);
      existing.downloadCount += count;
      // Manter carimbo de data/hora mais recente se aplicável
      if (completedAt && (!existing.completedAt || new Date(completedAt) > new Date(existing.completedAt))) {
        existing.completedAt = completedAt;
        existing.completed_at = completedAt;
        if (filePath) {
          existing.filePath = filePath;
          existing.filepath = filePath;
        }
        if (fileName) existing.filename = fileName;
        if (totalSize && totalSize !== "Concluído") existing.total_size = totalSize;
      }
      existing.rawItems.push(item);
    } else {
      map.set(mediaKey, {
        id: item.id || item.task_id || mediaKey,
        mediaKey,
        title: rawTitle,
        artist: sanitizeMetadataString(item.artist, ""),
        format: rawFormat,
        mode: item.mode || (rawFormat.includes("mp4") || rawFormat.includes("mkv") ? "video" : "audio"),
        total_size: totalSize,
        size: totalSize,
        filePath,
        filepath: filePath,
        filename: fileName,
        completedAt,
        completed_at: completedAt,
        downloadCount: count,
        rawItems: [item]
      });
    }
  }

  return Array.from(map.values());
}

export async function fetchHistory() {
  if (window.electronAPI?.getHistory) {
    const items = await window.electronAPI.getHistory();
    return aggregateHistory(items);
  }
  try {
    const res = await fetch("/api/history");
    const data = await res.json();
    return aggregateHistory(data.history || []);
  } catch (err) {
    console.error("[HistoryHandler] Erro ao carregar histórico:", err);
    return [];
  }
}

export async function deleteHistoryItem(mediaKey) {
  if (window.electronAPI?.deleteHistoryItem) {
    return await window.electronAPI.deleteHistoryItem(mediaKey);
  }
  try {
    const res = await fetch(`/api/history/${encodeURIComponent(mediaKey)}`, {
      method: "DELETE",
    });
    if (res.ok) {
      return await res.json();
    }
    const postRes = await fetch("/api/history/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ media_key: mediaKey }),
    });
    return await postRes.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function clearAllHistory() {
  if (window.electronAPI?.clearAllHistory) {
    return await window.electronAPI.clearAllHistory();
  }
  try {
    const res = await fetch("/api/history", {
      method: "DELETE",
    });
    if (res.ok) {
      return await res.json();
    }
    const postRes = await fetch("/api/history/clear", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "clear" }),
    });
    return await postRes.json();
  } catch (err) {
    return { success: false, error: err.message };
  }
}
