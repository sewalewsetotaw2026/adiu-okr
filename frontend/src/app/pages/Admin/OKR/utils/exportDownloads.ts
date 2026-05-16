import { SERVER_URL } from "../../../../API/apiRoutes";
import { okrAsArray } from "../../../../utils/okrApi";

function toAbsoluteUrl(pathOrUrl: string | null | undefined): string | null {
  if (!pathOrUrl) return null;
  const value = String(pathOrUrl).trim();
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith("/")) return `${SERVER_URL}${value}`;
  return `${SERVER_URL}/${value}`;
}

export function extractExportDownloadUrl(payload: any): string | null {
  const candidatePaths = [
    payload?.download_url,
    payload?.job?.download_url,
    payload?.file?.download_url,
    payload?.file?.storage_path,
    payload?.file?.url,
    payload?.generated_file_reference,
    payload?.job?.generated_file_reference,
  ];

  const files = okrAsArray<any>(payload?.files ?? payload?.job?.files);
  if (files.length > 0) {
    candidatePaths.push(
      files[0]?.download_url,
      files[0]?.storage_path,
      files[0]?.url,
    );
  }

  for (const candidate of candidatePaths) {
    const abs = toAbsoluteUrl(candidate);
    if (abs) return abs;
  }

  return null;
}

export function openExportDownload(payload: any): boolean {
  const url = extractExportDownloadUrl(payload);
  if (!url) return false;
  window.open(url, "_blank", "noopener,noreferrer");
  return true;
}
