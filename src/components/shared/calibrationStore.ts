// src/components/shared/calibrationStore.ts
// Instrument-agnostic calibration persistence: an AsyncStorage-backed store
// of pad positions, with a "generated calibration wins if newer than
// anything stored" rule shared by every instrument.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CalibratedPad } from "./padLayout";

export type CalibrationEnvelope = {
  updatedAt: number;
  holes: CalibratedPad[];
};

function isValidPad(value: unknown): value is CalibratedPad {
  const pad = value as Partial<CalibratedPad>;
  return (
    typeof pad.degree === "number" &&
    typeof pad.sourceX === "number" &&
    typeof pad.sourceY === "number" &&
    typeof pad.visibleRadius === "number" &&
    typeof pad.hitRadius === "number" &&
    typeof pad.isRoot === "boolean"
  );
}

export type CalibrationStoreConfig = {
  storageKey: string;
  legacyStorageKey?: string;
  padCount: number;
  generatedCalibration: unknown;
  cloneDefaultPads: () => CalibratedPad[];
};

export type CalibrationStore = {
  getGeneratedCalibration: () => CalibrationEnvelope;
  loadCalibration: () => Promise<CalibrationEnvelope>;
  saveCalibration: (holes: CalibratedPad[]) => Promise<CalibrationEnvelope>;
  resetCalibration: () => Promise<CalibrationEnvelope>;
};

export function createCalibrationStore(config: CalibrationStoreConfig): CalibrationStore {
  function normalizeEnvelope(value: unknown): CalibrationEnvelope | undefined {
    if (!value) return undefined;

    if (Array.isArray(value) && value.length === config.padCount && value.every(isValidPad)) {
      return { updatedAt: 0, holes: value };
    }

    const envelope = value as Partial<CalibrationEnvelope>;
    if (
      typeof envelope.updatedAt === "number" &&
      Array.isArray(envelope.holes) &&
      envelope.holes.length === config.padCount &&
      envelope.holes.every(isValidPad)
    ) {
      return envelope as CalibrationEnvelope;
    }

    return undefined;
  }

  function getGeneratedCalibration(): CalibrationEnvelope {
    return normalizeEnvelope(config.generatedCalibration) ?? { updatedAt: 0, holes: config.cloneDefaultPads() };
  }

  async function loadCalibration(): Promise<CalibrationEnvelope> {
    const generated = getGeneratedCalibration();

    const [stored, legacyStored] = await Promise.all([
      AsyncStorage.getItem(config.storageKey),
      config.legacyStorageKey ? AsyncStorage.getItem(config.legacyStorageKey) : Promise.resolve(null)
    ]);

    const local = normalizeEnvelope(stored ? JSON.parse(stored) : undefined);
    if (local && local.updatedAt >= generated.updatedAt) return local;

    const legacy = normalizeEnvelope(legacyStored ? JSON.parse(legacyStored) : undefined);
    if (legacy && legacy.updatedAt >= generated.updatedAt) return legacy;

    return generated;
  }

  async function saveCalibration(holes: CalibratedPad[]): Promise<CalibrationEnvelope> {
    const envelope: CalibrationEnvelope = {
      updatedAt: Date.now(),
      holes
    };
    await AsyncStorage.setItem(config.storageKey, JSON.stringify(envelope));
    return envelope;
  }

  async function resetCalibration(): Promise<CalibrationEnvelope> {
    await Promise.all([
      AsyncStorage.removeItem(config.storageKey),
      config.legacyStorageKey ? AsyncStorage.removeItem(config.legacyStorageKey) : Promise.resolve()
    ]);
    return getGeneratedCalibration();
  }

  return { getGeneratedCalibration, loadCalibration, saveCalibration, resetCalibration };
}
