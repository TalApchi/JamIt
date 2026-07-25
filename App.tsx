import React, { useMemo, useState } from "react";
import { SafeAreaView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { BambooFluteScreen } from "./src/screens/BambooFluteScreen";
import { KalimbaScreen } from "./src/screens/KalimbaScreen";
import { InstrumentSelectionScreen, Instrument } from "./src/screens/InstrumentSelectionScreen";
import { ScaleSelectionScreen } from "./src/screens/ScaleSelectionScreen";
import { RootNote, ScaleMode, getScaleName } from "./src/music/scaleEngine";

type Phase = "instrument" | "setup" | "playing";

const INSTRUMENT_LABEL: Record<Instrument, string> = {
  flute: "flute",
  kalimba: "kalimba"
};

export default function App() {
  const [phase, setPhase] = useState<Phase>("instrument");
  const [startsInCalibration, setStartsInCalibration] = useState(false);
  const [instrument, setInstrument] = useState<Instrument>("flute");
  const [rootNote, setRootNote] = useState<RootNote>("C");
  const [mode, setMode] = useState<ScaleMode>("major");

  const scaleName = useMemo(() => getScaleName(rootNote, mode), [rootNote, mode]);

  if (phase === "instrument") {
    return (
      <View style={styles.app}>
        <StatusBar hidden />
        <SafeAreaView style={styles.safe}>
          <View style={styles.welcome}>
            <Text style={styles.eyebrow}>JamIt</Text>
            <Text style={styles.title}>Choose an instrument.</Text>
            <InstrumentSelectionScreen instrument={instrument} onInstrumentChange={setInstrument} />
            <TouchableOpacity
              style={styles.startButton}
              activeOpacity={0.85}
              onPress={() => setPhase("setup")}
            >
              <Text style={styles.startText}>Next</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (phase === "setup") {
    return (
      <View style={styles.app}>
        <StatusBar hidden />
        <SafeAreaView style={styles.safe}>
          <View style={styles.welcome}>
            <Text style={styles.eyebrow}>JamIt</Text>
            <Text style={styles.title}>Choose a scale, then play the {INSTRUMENT_LABEL[instrument]}.</Text>
            <ScaleSelectionScreen
              rootNote={rootNote}
              mode={mode}
              onRootNoteChange={setRootNote}
              onModeChange={setMode}
            />
            <TouchableOpacity
              style={styles.startButton}
              activeOpacity={0.85}
              onPress={() => {
                setStartsInCalibration(false);
                setPhase("playing");
              }}
            >
              <Text style={styles.startText}>Start {scaleName}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.calibrateButton}
              activeOpacity={0.85}
              onPress={() => {
                setStartsInCalibration(true);
                setPhase("playing");
              }}
            >
              <Text style={styles.calibrateText}>Calibrate touch zones</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.changeInstrumentButton}
              activeOpacity={0.85}
              onPress={() => setPhase("instrument")}
            >
              <Text style={styles.changeInstrumentText}>Change instrument</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <>
      <StatusBar hidden />
      {instrument === "kalimba" ? (
        <KalimbaScreen
          rootNote={rootNote}
          mode={mode}
          initialCalibrationMode={startsInCalibration}
          onExit={() => setPhase("setup")}
          onExitCalibration={() => setStartsInCalibration(false)}
        />
      ) : (
        <BambooFluteScreen
          rootNote={rootNote}
          mode={mode}
          initialCalibrationMode={startsInCalibration}
          onExit={() => setPhase("setup")}
          onExitCalibration={() => setStartsInCalibration(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    backgroundColor: "#090b08"
  },
  safe: {
    flex: 1
  },
  welcome: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 22,
    paddingVertical: 28
  },
  eyebrow: {
    color: "#d8b16f",
    fontSize: 14,
    fontWeight: "800",
    letterSpacing: 3,
    marginBottom: 12,
    textTransform: "uppercase"
  },
  title: {
    color: "#fff3dc",
    fontSize: 34,
    fontWeight: "800",
    lineHeight: 39,
    marginBottom: 28
  },
  startButton: {
    alignItems: "center",
    backgroundColor: "#d89c4a",
    borderRadius: 8,
    marginTop: 28,
    minHeight: 56,
    justifyContent: "center"
  },
  startText: {
    color: "#170f06",
    fontSize: 17,
    fontWeight: "900"
  },
  calibrateButton: {
    alignItems: "center",
    borderColor: "rgba(255, 243, 220, 0.22)",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 10,
    minHeight: 50,
    justifyContent: "center"
  },
  calibrateText: {
    color: "#fff3dc",
    fontSize: 15,
    fontWeight: "800"
  },
  changeInstrumentButton: {
    alignItems: "center",
    marginTop: 16,
    minHeight: 32,
    justifyContent: "center"
  },
  changeInstrumentText: {
    color: "rgba(255, 243, 220, 0.62)",
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline"
  }
});
