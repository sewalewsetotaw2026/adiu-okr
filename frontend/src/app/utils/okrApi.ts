/** Helpers for OKR module API responses (matches typical `{ status, data }` backend shape). */

export function okrUnwrap<T = unknown>(axiosResponse: { data?: unknown }): T {
  const body = axiosResponse?.data as Record<string, unknown> | undefined;
  if (body && typeof body === "object" && "data" in body) {
    return body.data as T;
  }
  return body as T;
}

export function okrAsArray<T = unknown>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  return [];
}

/** Some list endpoints return `{ data: { items: [] } }` instead of a bare array. */
export function okrListRows(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    for (const k of ["items", "objectives", "rows"]) {
      const inner = o[k];
      if (Array.isArray(inner)) return inner;
    }
  }
  return [];
}

export function okrErrorMessage(error: unknown): string {
  const asBody = error as {
    message?: string;
    error?: string;
    errors?: unknown;
    response?: {
      data?: { message?: string; error?: string; errors?: unknown };
    };
  };
  if (typeof asBody?.message === "string") return asBody.message;
  if (typeof asBody?.error === "string") return asBody.error;
  if (Array.isArray(asBody?.errors) && asBody.errors.length) {
    const first = asBody.errors[0] as { msg?: string; message?: string };
    const m = first?.msg ?? first?.message;
    if (typeof m === "string") return m;
  }
  const d = asBody?.response?.data;
  if (typeof d?.message === "string") return d.message;
  if (typeof d?.error === "string") return d.error;
  if (Array.isArray(d?.errors) && d.errors.length) {
    const first = d.errors[0] as { msg?: string; message?: string };
    const m = first?.msg ?? first?.message;
    if (typeof m === "string") return m;
  }
  if (typeof (error as { message?: string })?.message === "string")
    return (error as { message: string }).message;
  return "Something went wrong";
}

/**
 * Employee KR execution_mode on the API (matches department semantics:
 * direct = as assigned; custom = employee-tailored wording, stored as DECOMPOSED/CUSTOMIZED).
 */
export function toBackendExecutionMode(
  mode: "direct_adoption" | "custom_adoption",
): "DIRECT_ADOPTION" | "DECOMPOSED" {
  return mode === "custom_adoption" ? "DECOMPOSED" : "DIRECT_ADOPTION";
}

export function fromBackendExecutionMode(
  raw: string | null | undefined,
): "direct_adoption" | "custom_adoption" | null {
  if (!raw) return null;
  const u = String(raw).toUpperCase();
  if (u === "CUSTOMIZED" || u === "DECOMPOSED") return "custom_adoption";
  if (u === "DIRECT_ADOPTION" || u === "DIRECT") return "direct_adoption";
  return null;
}

export function confidenceLevelFromScore(
  score: number,
  blocked: boolean,
): string {
  if (blocked) return "AT_RISK";
  if (score <= 2) return "AT_RISK";
  if (score >= 4) return "ON_TRACK";
  return "ON_TRACK";
}
