import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type Instrument = "flute" | "kalimba";

type Props = {
  instrument: Instrument;
  onInstrumentChange: (instrument: Instrument) => void;
};

const INSTRUMENTS: Array<{ id: Instrument; label: string }> = [
  { id: "flute", label: "Bamboo Flute" },
  { id: "kalimba", label: "Kalimba" }
];

export function InstrumentSelectionScreen({ instrument, onInstrumentChange }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Instrument</Text>
      <View style={styles.row}>
        {INSTRUMENTS.map((item) => {
          const isSelected = item.id === instrument;
          return (
            <TouchableOpacity
              key={item.id}
              activeOpacity={0.82}
              onPress={() => onInstrumentChange(item.id)}
              style={[styles.button, isSelected && styles.selectedButton]}
            >
              <Text style={[styles.buttonText, isSelected && styles.selectedText]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
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
    textTransform: "uppercase"
  },
  row: {
    flexDirection: "row",
    gap: 10
  },
  button: {
    alignItems: "center",
    backgroundColor: "rgba(255, 244, 221, 0.08)",
    borderColor: "rgba(255, 244, 221, 0.12)",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    height: 56,
    justifyContent: "center"
  },
  selectedButton: {
    backgroundColor: "#d89c4a",
    borderColor: "#f1c273"
  },
  buttonText: {
    color: "#fff3dc",
    fontSize: 16,
    fontWeight: "900"
  },
  selectedText: {
    color: "#170f06"
  }
});
