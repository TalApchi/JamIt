import { DISTORTION_GUITAR_PADS, cloneDefaultDistortionGuitarHoles } from "./holeLayout";
import { createCalibrationStore } from "../shared/calibrationStore";

export const CALIBRATION_STORAGE_KEY = "jamit:distortion-guitar:calibrated-holes:v1";

const generatedCalibration = require("./calibration.generated.json");

const store = createCalibrationStore({
  storageKey: CALIBRATION_STORAGE_KEY,
  padCount: DISTORTION_GUITAR_PADS.length,
  generatedCalibration,
  cloneDefaultPads: cloneDefaultDistortionGuitarHoles
});

export const getGeneratedCalibration = store.getGeneratedCalibration;
export const loadCalibration = store.loadCalibration;
export const saveCalibration = store.saveCalibration;
export const resetCalibration = store.resetCalibration;
