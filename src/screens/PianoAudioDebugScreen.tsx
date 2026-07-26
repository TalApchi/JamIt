// Temporary isolation tool: bypasses scale selection, degree/scale mapping,
// the touch engine, calibration, and all navigation logic entirely. Each
// button computes a fixed target MIDI directly and hands it straight to the
// SAME resolver + AudioEngine the real Melodica/Piano instrument uses:
//   button -> target MIDI -> resolveMelodicaSample -> AudioEngine -> speaker
// Nothing here goes through ScaleInstrument/MelodicaInstrument. If two
// buttons still sound identical, the bug is in resolveMelodicaSample/
// AudioEngine; if all 12 sound correct here but the real instrument doesn't,
// the bug is above this layer (scale/degree mapping or the touch engine).
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { AudioEngine, AudioNoteDebugInfo, PlayableNote } from "../audio/audioEngine";
import { resolveMelodicaSample } from "../audio/melodicaSamples";
import { CHROMATIC_NOTES } from "../music/scaleEngine";

type Props = {
  onExit: () => void;
};

// Fixed octave (C4..B4, MIDI 60..71) -- deliberately NOT derived from any
// scale/degree logic. The Melodica/Piano pack only has exact samples for C4
// and F#4 in this octave; every other button exercises resolveMelodicaSample's
// nearest-sample + runtime pitch-shift fallback (see
// src/audio/melodicaSampleData.ts), same as the Bamboo Flute's algorithm.
const BASE_MIDI = 60;

const DEBUG_NOTES: PlayableNote[] = CHROMATIC_NOTES.map((label, index) => ({
  key: `piano-audio-debug|${label}`,
  scaleName: "AudioDebug",
  padIndex: index + 1,
  noteWithOctave: `${label}4`,
  midi: BASE_MIDI + index
}));

export function PianoAudioDebugScreen({ onExit }: Props) {
  const audioEngine = useRef(new AudioEngine(resolveMelodicaSample)).current;
  const [lastDebug, setLastDebug] = useState<AudioNoteDebugInfo | null>(null);

  useEffect(() => {
    return () => {
      audioEngine.unload().catch(() => undefined);
    };
  }, [audioEngine]);

  const handlePressIn = (note: PlayableNote) => {
    setLastDebug(audioEngine.getDebugInfo(note));
    audioEngine.play(note.key, note).catch((error) => {
      console.warn(`Unable to play debug note ${note.noteWithOctave}`, error);
    });
  };

  const handlePressOut = (note: PlayableNote) => {
    audioEngine.stop(note.key).catch(() => undefined);
  };

  return (
    <View style={styles.screen}>
      <Text style={styles.title}>Audio Debug — Piano</Text>
      <Text style={styles.subtitle}>
        Button → target MIDI → resolveMelodicaSample → AudioEngine. No scale, degree, touch, or calibration
        logic involved.
      </Text>

      <View style={styles.grid}>
        {DEBUG_NOTES.map((note, index) => (
          <Pressable
            key={note.key}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPressIn={() => handlePressIn(note)}
            onPressOut={() => handlePressOut(note)}
          >
            <Text style={styles.buttonText}>{CHROMATIC_NOTES[index]}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.debugPanel}>
        <Text style={styles.debugTitle}>Last press</Text>
        {lastDebug ? (
          <>
            <DebugRow label="Target note" value={lastDebug.noteWithOctave} />
            <DebugRow label="Target MIDI" value={String(lastDebug.midi)} />
            <DebugRow label="Source sample" value={lastDebug.sourceFilename} />
            <DebugRow label="Source MIDI" value={String(lastDebug.sourceMidi)} />
            <DebugRow label="Playback rate" value={lastDebug.playbackRate.toFixed(4)} />
          </>
        ) : (
          <Text style={styles.debugPlaceholder}>Press a button to see its resolved mapping.</Text>
        )}
      </View>

      <Pressable style={styles.backButton} onPress={onExit} hitSlop={8}>
        <Text style={styles.backText}>Back</Text>
      </Pressable>
    </View>
  );
}

function DebugRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.debugRow}>
      <Text style={styles.debugLabel}>{label}</Text>
      <Text style={styles.debugValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#090b08",
    paddingTop: 60,
    paddingHorizontal: 20
  },
  title: {
    color: "#fff3dc",
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 6
  },
  subtitle: {
    color: "rgba(255, 243, 220, 0.62)",
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 20
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10
  },
  button: {
    alignItems: "center",
    backgroundColor: "rgba(255, 244, 221, 0.08)",
    borderColor: "rgba(255, 244, 221, 0.18)",
    borderRadius: 8,
    borderWidth: 1,
    height: 56,
    justifyContent: "center",
    width: "22%"
  },
  buttonPressed: {
    backgroundColor: "#d89c4a",
    borderColor: "#f1c273"
  },
  buttonText: {
    color: "#fff3dc",
    fontSize: 18,
    fontWeight: "900"
  },
  debugPanel: {
    marginTop: 28,
    padding: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(255, 243, 220, 0.16)",
    backgroundColor: "rgba(255, 244, 221, 0.05)"
  },
  debugTitle: {
    color: "rgba(255, 243, 220, 0.72)",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 1.4,
    textTransform: "uppercase",
    marginBottom: 10
  },
  debugPlaceholder: {
    color: "rgba(255, 243, 220, 0.5)",
    fontSize: 13
  },
  debugRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4
  },
  debugLabel: {
    color: "rgba(255, 243, 220, 0.6)",
    fontSize: 13
  },
  debugValue: {
    color: "#fff3dc",
    fontSize: 13,
    fontWeight: "700"
  },
  backButton: {
    marginTop: 24,
    alignSelf: "flex-start",
    minHeight: 40,
    paddingHorizontal: 14,
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
