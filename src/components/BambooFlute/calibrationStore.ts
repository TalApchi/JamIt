import AsyncStorage from "@react-native-async-storage/async-storage";
import { CalibratedFluteHole, cloneDefaultFluteHoles } from "./holeLayout";

type CalibrationEnvelope = {
  updatedAt: number;
  holes: CalibratedFluteHole[];
};

const generatedCalibration = require("./calibration.generated.json") as CalibrationEnvelope;

export const CALIBRATION_STORAGE_KEY = "jamit:bamboo-flute:calibrated-holes:v2";
const LEGACY_STORAGE_KEY = "jamit:bamboo-flute:calibrated-holes:v1";

function isValidHole(value: unknown): value is CalibratedFluteHole {
  const hole = value as Partial<CalibratedFluteHole>;
  return (
    typeof hole.degree === "number" &&
    typeof hole.sourceX === "number" &&
    typeof hole.sourceY === "number" &&
    typeof hole.visibleRadius === "number" &&
    typeof hole.hitRadius === "number" &&
    typeof hole.isRoot === "boolean"
  );
}

function normalizeEnvelope(value: unknown): CalibrationEnvelope | undefined {
  if (!value) return undefined;

  if (Array.isArray(value) && value.length === 7 && value.every(isValidHole)) {
    return { updatedAt: 0, holes: value };
  }

  const envelope = value as Partial<CalibrationEnvelope>;
  if (
    typeof envelope.updatedAt === "number" &&
    Array.isArray(envelope.holes) &&
    envelope.holes.length === 7 &&
    envelope.holes.every(isValidHole)
  ) {
    return envelope as CalibrationEnvelope;
  }

  return undefined;
}

export function getGeneratedCalibration(): CalibrationEnvelope {
  return normalizeEnvelope(generatedCalibration) ?? { updatedAt: 0, holes: cloneDefaultFluteHoles() };
}

export async function loadCalibration(): Promise<CalibrationEnvelope> {
  const generated = getGeneratedCalibration();

  const [stored, legacyStored] = await Promise.all([
    AsyncStorage.getItem(CALIBRATION_STORAGE_KEY),
    AsyncStorage.getItem(LEGACY_STORAGE_KEY)
  ]);

  const local = normalizeEnvelope(stored ? JSON.parse(stored) : undefined);
  if (local && local.updatedAt >= generated.updatedAt) return local;

  const legacy = normalizeEnvelope(legacyStored ? JSON.parse(legacyStored) : undefined);
  if (legacy && legacy.updatedAt >= generated.updatedAt) return legacy;

  return generated;
}

export async function saveCalibration(holes: CalibratedFluteHole[]) {
  const envelope: CalibrationEnvelope = {
    updatedAt: Date.now(),
    holes
  };
  await AsyncStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(envelope));
  return envelope;
}

export async function resetCalibration() {
  await Promise.all([
    AsyncStorage.removeItem(CALIBRATION_STORAGE_KEY),
    AsyncStorage.removeItem(LEGACY_STORAGE_KEY)
  ]);
  return getGeneratedCalibration();
}
