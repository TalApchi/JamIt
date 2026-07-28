import { SYNTH_BASS_PADS, cloneDefaultSynthBassHoles } from "./holeLayout";
import { createCalibrationStore } from "../shared/calibrationStore";

export const CALIBRATION_STORAGE_KEY = "jamit:synth-bass:calibrated-holes:v1";

const generatedCalibration = require("./calibration.generated.json");

const store = createCalibrationStore({
  storageKey: CALIBRATION_STORAGE_KEY,
  padCount: SYNTH_BASS_PADS.length,
  generatedCalibration,
  cloneDefaultPads: cloneDefaultSynthBassHoles
});

export const getGeneratedCalibration = store.getGeneratedCalibration;
export const loadCalibration = store.loadCalibration;
export const saveCalibration = store.saveCalibration;
export const resetCalibration = store.resetCalibration;
