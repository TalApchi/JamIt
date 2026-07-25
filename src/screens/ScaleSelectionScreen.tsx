import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { CHROMATIC_NOTES, RootNote, ScaleMode, getScaleName } from "../music/scaleEngine";

type Props = {
  rootNote: RootNote;
  mode: ScaleMode;
  onRootNoteChange: (note: RootNote) => void;
  onModeChange: (mode: ScaleMode) => void;
};

const PRESETS: Array<{ rootNote: RootNote; mode: ScaleMode }> = [
  { rootNote: "C", mode: "major" },
  { rootNote: "G", mode: "major" },
  { rootNote: "D", mode: "major" },
  { rootNote: "A", mode: "minor" },
  { rootNote: "E", mode: "minor" }
];

export function ScaleSelectionScreen({ rootNote, mode, onRootNoteChange, onModeChange }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Root note</Text>
      <View style={styles.noteGrid}>
        {CHROMATIC_NOTES.map((note) => {
          const isSelected = note === rootNote;
          return (
            <TouchableOpacity
              key={note}
              activeOpacity={0.82}
              onPress={() => onRootNoteChange(note)}
              style={[styles.noteButton, isSelected && styles.selectedButton]}
            >
              <Text style={[styles.noteText, isSelected && styles.selectedText]}>{note}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Mode</Text>
      <View style={styles.modeRow}>
        {(["major", "minor"] as const).map((scaleMode) => {
          const isSelected = scaleMode === mode;
          return (
            <TouchableOpacity
              key={scaleMode}
              activeOpacity={0.82}
              onPress={() => onModeChange(scaleMode)}
              style={[styles.modeButton, isSelected && styles.selectedButton]}
            >
              <Text style={[styles.modeText, isSelected && styles.selectedText]}>
                {scaleMode === "major" ? "Major" : "Minor"}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.sectionTitle}>Quick starts</Text>
      <View style={styles.presetRow}>
        {PRESETS.map((preset) => (
          <TouchableOpacity
            key={`${preset.rootNote}-${preset.mode}`}
            activeOpacity={0.82}
            onPress={() => {
              onRootNoteChange(preset.rootNote);
              onModeChange(preset.mode);
            }}
            style={styles.presetButton}
          >
            <Text style={styles.presetText}>{getScaleName(preset.rootNote, preset.mode)}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12
  },
  sectionTitle: {
    color: "rgba(255, 243, 220, 0.72)",
    fontSize: 13,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginTop: 8,
    textTransform: "uppercase"
  },
  noteGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  noteButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 244, 221, 0.08)",
    borderColor: "rgba(255, 244, 221, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: "15.1%"
  },
  selectedButton: {
    backgroundColor: "#d89c4a",
    borderColor: "#f1c273"
  },
  noteText: {
    color: "#fff3dc",
    fontSize: 16,
    fontWeight: "900"
  },
  selectedText: {
    color: "#170f06"
  },
  modeRow: {
    flexDirection: "row",
    gap: 10
  },
  modeButton: {
    alignItems: "center",
    backgroundColor: "rgba(255, 244, 221, 0.08)",
    borderColor: "rgba(255, 244, 221, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    height: 50,
    justifyContent: "center"
  },
  modeText: {
    color: "#fff3dc",
    fontSize: 16,
    fontWeight: "900"
  },
  presetRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  presetButton: {
    backgroundColor: "rgba(255, 244, 221, 0.08)",
    borderColor: "rgba(255, 244, 221, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11
  },
  presetText: {
    color: "#fff3dc",
    fontSize: 14,
    fontWeight: "800"
  }
});
