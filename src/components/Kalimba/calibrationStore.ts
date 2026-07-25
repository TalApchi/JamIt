import { KALIMBA_PADS, cloneDefaultKalimbaHoles } from "./holeLayout";
import { createCalibrationStore } from "../shared/calibrationStore";

export const CALIBRATION_STORAGE_KEY = "jamit:kalimba:calibrated-holes:v1";

const generatedCalibration = require("./calibration.generated.json");

const store = createCalibrationStore({
  storageKey: CALIBRATION_STORAGE_KEY,
  padCount: KALIMBA_PADS.length,
  generatedCalibration,
  cloneDefaultPads: cloneDefaultKalimbaHoles
});

export const getGeneratedCalibration = store.getGeneratedCalibration;
export const loadCalibration = store.loadCalibration;
export const saveCalibration = store.saveCalibration;
export const resetCalibration = store.resetCalibration;
