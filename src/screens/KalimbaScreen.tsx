import React, { useEffect } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as ScreenOrientation from "expo-screen-orientation";
import { KalimbaInstrument } from "../components/Kalimba/KalimbaInstrument";
import { RootNote, ScaleMode } from "../music/scaleEngine";

type Props = {
  rootNote: RootNote;
  mode: ScaleMode;
  initialCalibrationMode?: boolean;
  onExit: () => void;
  onExitCalibration?: () => void;
};

export function KalimbaScreen({
  rootNote,
  mode,
  initialCalibrationMode = false,
  onExit,
  onExitCalibration
}: Props) {
  // The Kalimba background image is landscape (1857x847); the rest of the
  // app is portrait, so this screen locks to landscape on mount and
  // restores portrait on unmount instead of relying on the phone's physical
  // rotation.
  useEffect(() => {
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch((error) => {
      console.warn("Unable to lock Kalimba screen to landscape", error);
    });

    return () => {
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(() => undefined);
    };
  }, []);

  return (
    <View style={styles.screen}>
      <KalimbaInstrument
        rootNote={rootNote}
        mode={mode}
        initialCalibrationMode={initialCalibrationMode}
        onExitCalibration={onExitCalibration}
      />
      <Pressable style={styles.backButton} onPress={onExit} hitSlop={8}>
        <Text style={styles.backText}>Back to Scale Selection</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#020302"
  },
  backButton: {
    position: "absolute",
    top: 14,
    left: 14,
    minHeight: 40,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8, 16, 13, 0.82)",
    borderColor: "rgba(255, 239, 206, 0.28)",
    borderWidth: 1
  },
  backText: {
    color: "#fff0cf",
    fontWeight: "900",
    fontSize: 13
  }
});
