import { okrAsArray } from "../../../../../utils/okrApi";
import { Archive } from "./types";

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso).slice(0, 10);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function parseYearFromText(value: string | null | undefined): number | null {
  if (!value) return null;
  const m = String(value).match(/\b(20\d{2})\b/);
  if (!m) return null;
  const y = Number(m[1]);
  return Number.isFinite(y) ? y : null;
}

export function getArchiveYear(archive: Archive): number | null {
  const dateCandidates = [
    archive.archived_at,
    archive.cycle?.start_date,
    archive.cycle?.end_date,
  ];

  for (const candidate of dateCandidates) {
    if (!candidate) continue;
    const d = new Date(candidate);
    if (!Number.isNaN(d.getTime())) return d.getFullYear();
  }

  const textCandidates = [
    archive.quarter_name,
    archive.cycle?.quarter_label,
    archive.cycle?.name,
  ];

  for (const candidate of textCandidates) {
    const y = parseYearFromText(candidate);
    if (y) return y;
  }

  return null;
}

export function normalizeArchive(raw: any): Archive {
  const snapshots = okrAsArray<any>(raw?.snapshots);
  // snapshots come back ordered ASC — last element is most recent
  const latest = snapshots[snapshots.length - 1] ?? null;

  // The backend's enriched listArchives response puts score/completion at the
  // top level. Fall back to snapshot fields when the list doesn't include them.
  const score =
    raw?.score != null
      ? Number(raw.score)
      : raw?.avg_score != null
        ? Number(raw.avg_score)
        : raw?.aggregate_score != null
          ? Number(raw.aggregate_score)
          : latest?.score_value != null
            ? Number(latest.score_value)
            : latest?.avg_score != null
              ? Number(latest.avg_score)
              : null;

  const completion_rate =
    raw?.completion_rate != null
      ? Number(raw.completion_rate)
      : latest?.completion_rate != null
        ? Number(latest.completion_rate)
        : latest?.progress_percent != null
          ? Number(latest.progress_percent)
          : null;

  const total_objectives =
    raw?.total_objectives != null
      ? Number(raw.total_objectives)
      : latest?.total_objectives != null
        ? Number(latest.total_objectives)
        : 0;

  const total_key_results =
    raw?.total_key_results != null
      ? Number(raw.total_key_results)
      : latest?.total_key_results != null
        ? Number(latest.total_key_results)
        : 0;

  return {
    id: raw?.id,
    quarter_name: raw?.quarter_name,
    archived_at: raw?.archived_at,
    cycle: raw?.cycle,
    snapshots,
    score: score ?? undefined,
    completion_rate: completion_rate ?? undefined,
    total_objectives,
    total_key_results,
  };
}

export function getScore(archive: Archive): number | null {
  if (archive.score != null) return Number(archive.score);
  const snaps = Array.isArray(archive.snapshots) ? archive.snapshots : [];
  const last = snaps[snaps.length - 1];
  if (!last) return null;
  const raw = last?.score_value ?? last?.avg_score;
  return raw != null ? Number(raw) : null;
}

export function getCompletion(archive: Archive): number | null {
  if (archive.completion_rate != null) return Number(archive.completion_rate);
  const snaps = Array.isArray(archive.snapshots) ? archive.snapshots : [];
  const last = snaps[snaps.length - 1];
  if (!last) return null;
  const raw = last?.completion_rate ?? last?.progress_percent;
  return raw != null ? Number(raw) : null;
}
