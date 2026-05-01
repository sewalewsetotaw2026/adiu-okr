import { resolveConfigValue } from "src/services/okrConfigResolverService";

export type OkrConfidenceStatus = "ON_TRACK" | "AT_RISK" | "OFF_TRACK";

interface ConfidenceLevelMapping {
  off_track_lte_percent: number;
  at_risk_lte_percent: number;
  on_track_gte_percent: number;
}

interface ComputeMeasurementInput {
  companyId: number;
  cycleId?: number;
  departmentId?: number;
  targetValue?: number | null;
  currentValue?: number | null;
  useCurrentAsPercentWhenNoTarget?: boolean;
}

const DEFAULT_CONFIDENCE_MAPPING: ConfidenceLevelMapping = {
  off_track_lte_percent: 40,
  at_risk_lte_percent: 59,
  on_track_gte_percent: 60,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function toOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return parsed;
}

function toPercent(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(0, Math.min(100, parsed));
}

function round2(value: number): number {
  return Number(value.toFixed(2));
}

function normalizeConfidenceMapping(raw: unknown): ConfidenceLevelMapping {
  if (!isRecord(raw)) {
    return DEFAULT_CONFIDENCE_MAPPING;
  }

  const offTrack = toPercent(
    raw.off_track_lte_percent,
    DEFAULT_CONFIDENCE_MAPPING.off_track_lte_percent,
  );
  const atRisk = toPercent(
    raw.at_risk_lte_percent,
    DEFAULT_CONFIDENCE_MAPPING.at_risk_lte_percent,
  );
  const onTrack = toPercent(
    raw.on_track_gte_percent,
    DEFAULT_CONFIDENCE_MAPPING.on_track_gte_percent,
  );

  const normalizedOff = Math.min(offTrack, atRisk);
  const normalizedAtRisk = Math.max(offTrack, atRisk);
  const normalizedOn = Math.max(onTrack, normalizedAtRisk);

  return {
    off_track_lte_percent: normalizedOff,
    at_risk_lte_percent: normalizedAtRisk,
    on_track_gte_percent: normalizedOn,
  };
}

export async function getConfidenceLevelMapping(params: {
  companyId: number;
  cycleId?: number;
  departmentId?: number;
}): Promise<ConfidenceLevelMapping> {
  const { companyId, cycleId, departmentId } = params;

  const directMapping = await resolveConfigValue({
    companyId,
    configKey: "confidence_level_mapping",
    cycleId,
    departmentId,
  });

  if (isRecord(directMapping)) {
    return normalizeConfidenceMapping(directMapping);
  }

  const additionalConfig = await resolveConfigValue({
    companyId,
    configKey: "additional_configuration",
    cycleId,
    departmentId,
  });

  if (
    isRecord(additionalConfig) &&
    isRecord(additionalConfig.confidence_level_mapping)
  ) {
    return normalizeConfidenceMapping(
      additionalConfig.confidence_level_mapping,
    );
  }

  return DEFAULT_CONFIDENCE_MAPPING;
}

export function computeProgressPercent(params: {
  currentValue?: number | null;
  targetValue?: number | null;
  useCurrentAsPercentWhenNoTarget?: boolean;
}): number | null {
  const currentValue = toOptionalNumber(params.currentValue);
  const targetValue = toOptionalNumber(params.targetValue);

  if (currentValue === null) {
    return null;
  }

  if (targetValue !== null && targetValue > 0) {
    const ratioPercent = (currentValue / targetValue) * 100;
    return round2(Math.max(0, Math.min(100, ratioPercent)));
  }

  if (params.useCurrentAsPercentWhenNoTarget) {
    return round2(Math.max(0, Math.min(100, currentValue)));
  }

  return null;
}

export function resolveConfidenceLevelFromProgress(params: {
  progressPercent?: number | null;
  mapping: ConfidenceLevelMapping;
}): OkrConfidenceStatus | null {
  const progressPercent = toOptionalNumber(params.progressPercent);
  if (progressPercent === null) {
    return null;
  }

  if (progressPercent >= params.mapping.on_track_gte_percent) {
    return "ON_TRACK";
  }

  if (progressPercent <= params.mapping.off_track_lte_percent) {
    return "OFF_TRACK";
  }

  if (progressPercent <= params.mapping.at_risk_lte_percent) {
    return "AT_RISK";
  }

  return "AT_RISK";
}

export async function computeMeasurementSnapshot(
  input: ComputeMeasurementInput,
): Promise<{
  targetValue: number | null;
  currentValue: number | null;
  progressPercent: number | null;
  confidenceLevel: OkrConfidenceStatus | null;
}> {
  const targetValue = toOptionalNumber(input.targetValue);
  const currentValue = toOptionalNumber(input.currentValue);
  const progressPercent = computeProgressPercent({
    currentValue,
    targetValue,
    useCurrentAsPercentWhenNoTarget: input.useCurrentAsPercentWhenNoTarget,
  });

  const mapping = await getConfidenceLevelMapping({
    companyId: input.companyId,
    cycleId: input.cycleId,
    departmentId: input.departmentId,
  });

  const confidenceLevel = resolveConfidenceLevelFromProgress({
    progressPercent,
    mapping,
  });

  return {
    targetValue,
    currentValue,
    progressPercent,
    confidenceLevel,
  };
}
