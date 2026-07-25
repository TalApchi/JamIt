import { CalibratedFluteHole, cloneDefaultFluteHoles } from "./holeLayout";
import { createCalibrationStore } from "../shared/calibrationStore";

export const CALIBRATION_STORAGE_KEY = "jamit:bamboo-flute:calibrated-holes:v2";
const LEGACY_STORAGE_KEY = "jamit:bamboo-flute:calibrated-holes:v1";

const generatedCalibration = require("./calibration.generated.json");

const store = createCalibrationStore({
  storageKey: CALIBRATION_STORAGE_KEY,
  legacyStorageKey: LEGACY_STORAGE_KEY,
  padCount: 7,
  generatedCalibration,
  cloneDefaultPads: cloneDefaultFluteHoles
});

export const getGeneratedCalibration = store.getGeneratedCalibration;
export const loadCalibration = store.loadCalibration;
export const saveCalibration = store.saveCalibration;
export const resetCalibration = store.resetCalibration;

export type { CalibratedFluteHole };
