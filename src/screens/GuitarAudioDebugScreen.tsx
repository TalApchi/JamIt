// Temporary isolation tool: bypasses scale selection, degree/scale mapping,
// the touch engine, calibration, and all navigation logic entirely. Each
// button computes a fixed target MIDI directly and hands it straight to the
// SAME resolver + AudioEngine the real Distortion Guitar instrument uses:
//   button -> target MIDI -> resolveDistortionGuitarSample -> AudioEngine -> speaker
// Nothing here goes through ScaleInstrument/DistortionGuitarInstrument. If a
// button sounds wrong here, the bug is in resolveDistortionGuitarSample/
// AudioEngine; if every button sounds correct here but the real instrument
// doesn't, the bug is above this layer (scale/degree mapping or the touch
// engine).
import React, { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { AudioEngine, AudioNoteDebugInfo, PlayableNote } from "../audio/audioEngine";
import { resolveDistortionGuitarSample } from "../audio/distortionGuitarSamples";
import { midiToNoteWithOctave } from "../music/noteEngine";

type Props = {
  onExit: () => void;
};

// The full range the real instrument can ever produce (MIDI 60..94, C4..A#6
// -- see distortionGuitarSampleData.ts): 35 buttons, one per note, NOT
// derived from any scale/degree logic. This is wider than the other
// instruments' 12-button debug screens because the Distortion Guitar has 14
// pads across two octave rows, so verifying "every generated note" means
// verifying all 35, not just one octave.
const MIN_MIDI = 60;
const MAX_MIDI = 94;

const DEBUG_NOTES: PlayableNote[] = [];
for (let midi = MIN_MIDI; midi <= MAX_MIDI; midi++) {
  const noteWithOctave = midiToNoteWithOctave(midi);
  DEBUG_NOTES.push({
    key: `guitar-audio-debug|${noteWithOctave}`,
    scaleName: "AudioDebug",
    padIndex: midi - MIN_MIDI + 1,
    noteWithOctave,
    midi
  });
}

export function GuitarAudioDebugScreen({ onExit }: Props) {
  const audioEngine = useRef(new AudioEngine(resolveDistortionGuitarSample)).current;
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
      <Text style={styles.title}>Audio Debug — Distortion Guitar</Text>
      <Text style={styles.subtitle}>
        Button → target MIDI → resolveDistortionGuitarSample → AudioEngine. No scale, degree, touch, or
        calibration logic involved. 35 notes, MIDI {MIN_MIDI}..{MAX_MIDI} (C4..A#6).
      </Text>

      <ScrollView contentContainerStyle={styles.grid}>
        {DEBUG_NOTES.map((note) => (
          <Pressable
            key={note.key}
            style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            onPressIn={() => handlePressIn(note)}
            onPressOut={() => handlePressOut(note)}
          >
            <Text style={styles.buttonText}>{note.noteWithOctave}</Text>
          </Pressable>
        ))}
      </ScrollView>

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
    gap: 10,
    paddingBottom: 12
  },
  button: {
    alignItems: "center",
    backgroundColor: "rgba(255, 244, 221, 0.08)",
    borderColor: "rgba(255, 244, 221, 0.18)",
    borderRadius: 8,
    borderWidth: 1,
    height: 56,
    justifyContent: "center",
    width: "18%"
  },
  buttonPressed: {
    backgroundColor: "#d89c4a",
    borderColor: "#f1c273"
  },
  buttonText: {
    color: "#fff3dc",
    fontSize: 14,
    fontWeight: "900"
  },
  debugPanel: {
    marginTop: 16,
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
    marginTop: 16,
    marginBottom: 20,
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
