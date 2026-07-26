import { MELODICA_PADS, cloneDefaultMelodicaHoles } from "./holeLayout";
import { createCalibrationStore } from "../shared/calibrationStore";

export const CALIBRATION_STORAGE_KEY = "jamit:melodica:calibrated-holes:v1";

const generatedCalibration = require("./calibration.generated.json");

const store = createCalibrationStore({
  storageKey: CALIBRATION_STORAGE_KEY,
  padCount: MELODICA_PADS.length,
  generatedCalibration,
  cloneDefaultPads: cloneDefaultMelodicaHoles
});

export const getGeneratedCalibration = store.getGeneratedCalibration;
export const loadCalibration = store.loadCalibration;
export const saveCalibration = store.saveCalibration;
export const resetCalibration = store.resetCalibration;
