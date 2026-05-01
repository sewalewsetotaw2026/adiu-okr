import {
  computeMeasurementSnapshot,
  computeProgressPercent,
  getConfidenceLevelMapping,
  resolveConfidenceLevelFromProgress,
} from "src/services/okrMeasurementService";
import { resolveConfigValue } from "src/services/okrConfigResolverService";

jest.mock("src/services/okrConfigResolverService", () => ({
  resolveConfigValue: jest.fn(),
}));

const mockResolveConfigValue = resolveConfigValue as jest.MockedFunction<
  typeof resolveConfigValue
>;

describe("OKR Measurement Service", () => {
  beforeEach(() => {
    mockResolveConfigValue.mockReset();
    mockResolveConfigValue.mockResolvedValue(null as any);
  });

  describe("computeProgressPercent", () => {
    it("computes ratio when target is provided", () => {
      expect(
        computeProgressPercent({
          currentValue: 50,
          targetValue: 100,
        }),
      ).toBe(50);
    });

    it("clamps progress to 100", () => {
      expect(
        computeProgressPercent({
          currentValue: 200,
          targetValue: 100,
        }),
      ).toBe(100);
    });

    it("clamps progress to 0 for negative values", () => {
      expect(
        computeProgressPercent({
          currentValue: -20,
          targetValue: 100,
        }),
      ).toBe(0);
    });

    it("uses current value as percent when no target and flag is enabled", () => {
      expect(
        computeProgressPercent({
          currentValue: 63,
          targetValue: null,
          useCurrentAsPercentWhenNoTarget: true,
        }),
      ).toBe(63);
    });

    it("returns null when no target and no fallback flag", () => {
      expect(
        computeProgressPercent({
          currentValue: 63,
          targetValue: null,
          useCurrentAsPercentWhenNoTarget: false,
        }),
      ).toBeNull();
    });

    it("returns null when current value is missing", () => {
      expect(
        computeProgressPercent({
          currentValue: null,
          targetValue: 100,
        }),
      ).toBeNull();
    });
  });

  describe("resolveConfidenceLevelFromProgress", () => {
    const mapping = {
      off_track_lte_percent: 40,
      at_risk_lte_percent: 59,
      on_track_gte_percent: 60,
    };

    it("returns ON_TRACK at or above threshold", () => {
      expect(
        resolveConfidenceLevelFromProgress({
          progressPercent: 60,
          mapping,
        }),
      ).toBe("ON_TRACK");
    });

    it("returns OFF_TRACK at or below off-track threshold", () => {
      expect(
        resolveConfidenceLevelFromProgress({
          progressPercent: 40,
          mapping,
        }),
      ).toBe("OFF_TRACK");
    });

    it("returns AT_RISK in middle range", () => {
      expect(
        resolveConfidenceLevelFromProgress({
          progressPercent: 50,
          mapping,
        }),
      ).toBe("AT_RISK");
    });
  });

  describe("getConfidenceLevelMapping", () => {
    it("prefers direct confidence mapping from configuration", async () => {
      mockResolveConfigValue.mockImplementation(async ({ configKey }) => {
        if (configKey === "confidence_level_mapping") {
          return {
            off_track_lte_percent: 30,
            at_risk_lte_percent: 55,
            on_track_gte_percent: 70,
          };
        }
        return null;
      });

      const mapping = await getConfidenceLevelMapping({ companyId: 1 });

      expect(mapping).toEqual({
        off_track_lte_percent: 30,
        at_risk_lte_percent: 55,
        on_track_gte_percent: 70,
      });
    });

    it("falls back to default mapping when no config exists", async () => {
      const mapping = await getConfidenceLevelMapping({ companyId: 1 });

      expect(mapping).toEqual({
        off_track_lte_percent: 40,
        at_risk_lte_percent: 59,
        on_track_gte_percent: 60,
      });
    });
  });

  describe("computeMeasurementSnapshot", () => {
    it("computes final fields from target/current values", async () => {
      mockResolveConfigValue.mockImplementation(async ({ configKey }) => {
        if (configKey === "confidence_level_mapping") {
          return {
            off_track_lte_percent: 30,
            at_risk_lte_percent: 59,
            on_track_gte_percent: 60,
          };
        }
        return null;
      });

      const snapshot = await computeMeasurementSnapshot({
        companyId: 1,
        targetValue: 200,
        currentValue: 120,
      });

      expect(snapshot.targetValue).toBe(200);
      expect(snapshot.currentValue).toBe(120);
      expect(snapshot.progressPercent).toBe(60);
      expect(snapshot.confidenceLevel).toBe("ON_TRACK");
      expect(snapshot.progressPercent).toBe(60);
    });

    it("returns null progress/confidence when no computable inputs", async () => {
      const snapshot = await computeMeasurementSnapshot({
        companyId: 1,
        targetValue: null,
        currentValue: null,
      });

      expect(snapshot.progressPercent).toBeNull();
      expect(snapshot.confidenceLevel).toBeNull();
      expect(snapshot.progressPercent).toBeNull();
    });
  });
});
