// src/components/shared/ScaleInstrument.tsx
// Shared touch/gesture engine for every scale-mapped instrument: hold-to-play,
// slide-between-pads, multi-touch, and calibration mode. Instrument-specific
// bits (image, default pad layout, sample resolver, calibration storage) are
// passed in as props so the Flute and Kalimba run on one engine, not two.
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ImageBackground,
  LayoutChangeEvent,
  NativeTouchEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View
} from "react-native";
import * as Haptics from "expo-haptics";
import { AudioEngine, PlayableNote } from "../../audio/audioEngine";
import { SampleResolver } from "../../audio/sampleTypes";
import { RootNote, ScaleMode, getScaleName } from "../../music/scaleEngine";
import { generatePitchedScale } from "../../music/noteEngine";
import {
  CalibratedPad,
  ImageSize,
  PadShape,
  RenderedImageFrame,
  containerPointToSource,
  getCoverFrame,
  sourcePointToContainer
} from "./padLayout";
import { CalibrationStore } from "./calibrationStore";

export type ScaleInstrumentProps = {
  rootNote: RootNote;
  mode: ScaleMode;
  initialCalibrationMode?: boolean;
  onExitCalibration?: () => void;
  instrumentLabel: string;
  imageSource: number;
  imageSize: ImageSize;
  defaultPads: CalibratedPad[];
  resolveSample: SampleResolver;
  calibrationStore: CalibrationStore;
  // Milliseconds a touch must hold before a note starts sounding (a shorter
  // tap stays silent). Defaults to NOTE_START_HOLD_MS, matching the Flute's
  // breath-instrument feel. Pass 0 for an instrument (like a plucked
  // Kalimba) where every tap, however brief, should sound immediately on
  // touch-down.
  noteStartHoldMs?: number;
  // Whether lifting a finger stops its note. Defaults to true, matching the
  // Flute's breath-instrument feel (hold-to-sustain, release-to-stop). Pass
  // false for a plucked instrument (like the Kalimba) where releasing
  // should NOT silence the note -- it keeps ringing and finishes on its own,
  // like a real tine you're no longer touching.
  stopOnRelease?: boolean;
  // Touch-zone shape in calibration mode (and for hit-testing during normal
  // play). Defaults to "circle", matching the Flute and Kalimba's round
  // holes/tines. Pass "rectangle" for an instrument whose touch targets are
  // naturally rectangular (like the Melodica/Piano's white keys) -- pads
  // then use hitRadius/visibleRadius as a half-width paired with
  // hitHeight/visibleHeight as a half-height (see CalibratedPad), resized
  // independently per axis instead of radially.
  padShape?: PadShape;
};

type ActiveTouch = {
  degree?: number;
  note?: PlayableNote;
  isSounding: boolean;
  startTimer?: ReturnType<typeof setTimeout>;
  startedAt: number;
};

type CalibrationDragMode = "move" | "resize";

const HIT_ZONE_GAP = 4;
// Default hold-to-play threshold (a press shorter than this is a "quick tap"
// and stays silent; holding past it starts the note; slides after this
// window switch notes instantly). Instruments can override via the
// `noteStartHoldMs` prop — see its doc comment.
const NOTE_START_HOLD_MS = 90;

export function ScaleInstrument({
  rootNote,
  mode,
  initialCalibrationMode = false,
  onExitCalibration,
  instrumentLabel,
  imageSource,
  imageSize,
  defaultPads,
  resolveSample,
  calibrationStore,
  noteStartHoldMs = NOTE_START_HOLD_MS,
  stopOnRelease = true,
  padShape = "circle"
}: ScaleInstrumentProps) {
  const isRectangle = padShape === "rectangle";
  const audioEngine = useRef(new AudioEngine(resolveSample)).current;
  const activeTouches = useRef(new Map<string, ActiveTouch>());
  const calibrationGesture = useRef<{ degree: number; mode: CalibrationDragMode } | null>(null);

  const initialCalibration = calibrationStore.getGeneratedCalibration();
  const [holes, setHoles] = useState<CalibratedPad[]>(initialCalibration.holes ?? defaultPads);
  const [savedHoles, setSavedHoles] = useState<CalibratedPad[]>(initialCalibration.holes ?? defaultPads);
  const [frame, setFrame] = useState<RenderedImageFrame | null>(null);
  const [isCalibrationMode, setIsCalibrationMode] = useState(initialCalibrationMode);

  const scale = useMemo(() => generatePitchedScale(rootNote, mode), [rootNote, mode]);
  const scaleName = useMemo(() => getScaleName(rootNote, mode), [rootNote, mode]);

  useEffect(() => {
    setIsCalibrationMode(initialCalibrationMode);
  }, [initialCalibrationMode]);

  useEffect(() => {
    let isMounted = true;
    calibrationStore
      .loadCalibration()
      .then((calibration) => {
        if (!isMounted) return;
        setHoles(calibration.holes);
        setSavedHoles(calibration.holes);
      })
      .catch((error) => console.warn(`Unable to load ${instrumentLabel} calibration`, error));

    return () => {
      isMounted = false;
    };
  }, [calibrationStore, instrumentLabel]);

  useEffect(() => {
    let isMounted = true;
    audioEngine.preload().catch((error) => {
      if (isMounted) {
        console.warn(`Unable to preload ${instrumentLabel} audio`, error);
      }
    });

    return () => {
      isMounted = false;
      activeTouches.current.forEach((touch) => {
        if (touch.startTimer) clearTimeout(touch.startTimer);
      });
      activeTouches.current.clear();
      audioEngine.unload().catch(() => undefined);
    };
  }, [audioEngine, instrumentLabel]);

  useEffect(() => {
    activeTouches.current.forEach((touch) => {
      if (touch.startTimer) clearTimeout(touch.startTimer);
    });
    activeTouches.current.clear();
    audioEngine.stopAll().catch(() => undefined);
  }, [audioEngine, rootNote, mode]);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      setFrame(getCoverFrame(width, height, imageSize));
    },
    [imageSize]
  );

  const getEffectiveHitRadius = useCallback(
    (hole: CalibratedPad) => {
      const nearestDistance = holes.reduce((nearest, other) => {
        if (other.degree === hole.degree) return nearest;
        const distance = Math.hypot(hole.sourceX - other.sourceX, hole.sourceY - other.sourceY);
        return Math.min(nearest, distance);
      }, Number.POSITIVE_INFINITY);
      const nonOverlappingRadius = Number.isFinite(nearestDistance)
        ? Math.max(24, nearestDistance / 2 - HIT_ZONE_GAP)
        : hole.hitRadius;

      return Math.min(hole.hitRadius, nonOverlappingRadius);
    },
    [holes]
  );

  const isPointInsideHole = useCallback(
    (hole: CalibratedPad, x: number, y: number) => {
      if (!frame) return undefined;

      const point = sourcePointToContainer(hole.sourceX, hole.sourceY, frame);
      const dx = x - point.x;
      const dy = y - point.y;

      // Rectangles are calibrated directly to fit each key's real footprint
      // (including deliberately-tight fits between adjacent narrow keys), so
      // -- unlike circles -- their hit box is used exactly as sized, with no
      // automatic overlap-shrinking.
      if (isRectangle) {
        const halfWidth = hole.hitRadius * frame.scale;
        const halfHeight = (hole.hitHeight ?? hole.hitRadius) * frame.scale;
        return Math.abs(dx) <= halfWidth && Math.abs(dy) <= halfHeight;
      }

      const hitRadius = getEffectiveHitRadius(hole) * frame.scale;
      return dx * dx + dy * dy <= hitRadius * hitRadius;
    },
    [frame, getEffectiveHitRadius, isRectangle]
  );

  const findHoleDegreeAtPoint = useCallback(
    (x: number, y: number) => {
      if (!frame) return undefined;

      const containing = holes.filter((hole) => isPointInsideHole(hole, x, y));
      if (containing.length === 0) return undefined;
      if (containing.length === 1) return containing[0].degree;

      const nearest = containing.reduce((best, hole) => {
        const point = sourcePointToContainer(hole.sourceX, hole.sourceY, frame);
        const distance = Math.hypot(x - point.x, y - point.y);
        if (distance < best.distance) {
          return { degree: hole.degree, distance };
        }
        return best;
      }, { degree: containing[0].degree, distance: Number.POSITIVE_INFINITY });

      return nearest.degree;
    },
    [frame, holes, isPointInsideHole]
  );

  const getPlayableNote = useCallback(
    (degree: number): PlayableNote | undefined => {
      const note = scale[degree - 1];
      if (!note) return undefined;

      return {
        key: `${scaleName}|pad-${degree}|${note.noteWithOctave}`,
        scaleName,
        padIndex: degree,
        noteWithOctave: note.noteWithOctave,
        midi: note.midi
      };
    },
    [scale, scaleName]
  );

  // Preload one player per scale degree so the first press has no load
  // latency, and rebuild the mapping whenever the scale changes.
  useEffect(() => {
    const notes = scale
      .map((degree) => getPlayableNote(degree.degree))
      .filter((note): note is PlayableNote => Boolean(note));
    audioEngine.prepareScale(notes).catch((error) => {
      console.warn("Unable to preload scale samples", error);
    });
  }, [audioEngine, getPlayableNote, scale]);

  const logCurrentMapping = useCallback(() => {
    const lines = scale.map((degree) => {
      const note = getPlayableNote(degree.degree);
      if (!note) return "";
      const debug = audioEngine.getDebugInfo(note);
      return [
        `pad=${degree.degree}`,
        `target=${note.noteWithOctave}`,
        `source=${debug.sourceFilename}`,
        `shift=${debug.semitoneShift}`,
        `playbackRate=${debug.playbackRate.toFixed(3)}`,
        `key=${note.key}`
      ].join(" ");
    });

    console.log(`[${instrumentLabel} mapping] ${scaleName}\n${lines.join("\n")}`);
  }, [audioEngine, getPlayableNote, instrumentLabel, scale, scaleName]);

  useEffect(() => {
    logCurrentMapping();
  }, [logCurrentMapping]);

  const logTouchEvent = useCallback(
    (eventType: "press" | "release", touchId: string, degree: number, note: PlayableNote) => {
      const debug = audioEngine.getDebugInfo(note);
      console.log(
        [
          `[${instrumentLabel} ${eventType}]`,
          `pad=${degree}`,
          `degree=${degree}`,
          `scale=${note.scaleName}`,
          `target=${note.noteWithOctave}`,
          `targetMidi=${note.midi}`,
          `source=${debug.sourceFilename}`,
          `sourceMidi=${debug.sourceMidi}`,
          `shift=${debug.semitoneShift}`,
          `playbackRate=${debug.playbackRate.toFixed(3)}`,
          `key=${note.key}`,
          `pointer=${touchId}`
        ].join(" ")
      );
    },
    [audioEngine, instrumentLabel]
  );

  const startNoteForTouch = useCallback(
    (touchId: string, active: ActiveTouch) => {
      if (!active.degree || !active.note) return;

      active.isSounding = true;
      Haptics.selectionAsync().catch(() => undefined);
      logTouchEvent("press", touchId, active.degree, active.note);
      // AudioEngine.play swaps the touch's note atomically: a slide stops the
      // old note exactly once and starts the new note exactly once.
      audioEngine.play(touchId, active.note).catch((error) => {
        console.warn(`Unable to play note ${active.note?.noteWithOctave}`, error);
      });
    },
    [audioEngine, logTouchEvent]
  );

  const stopTouchById = useCallback(
    (touchId: string) => {
      const active = activeTouches.current.get(touchId);
      activeTouches.current.delete(touchId);
      if (!active) return;

      // Quick tap: the start timer has not fired yet, so no sound at all.
      if (active.startTimer) clearTimeout(active.startTimer);
      if (!active.isSounding || !active.degree || !active.note) return;

      logTouchEvent("release", touchId, active.degree, active.note);
      if (stopOnRelease) {
        audioEngine.stop(touchId).catch(() => undefined);
      } else {
        // Detach bookkeeping only; the note keeps sounding and finishes on
        // its own (see AudioEngine.release's own doc comment).
        audioEngine.release(touchId);
      }
    },
    [audioEngine, logTouchEvent, stopOnRelease]
  );

  const handleTouchStart = useCallback(
    (touch: NativeTouchEvent) => {
      if (isCalibrationMode) return;
      const touchId = String(touch.identifier);
      if (activeTouches.current.has(touchId)) return;

      const degree = findHoleDegreeAtPoint(touch.locationX, touch.locationY);
      const note = degree ? getPlayableNote(degree) : undefined;
      const active: ActiveTouch = {
        degree: note ? degree : undefined,
        note,
        isSounding: false,
        startedAt: Date.now()
      };
      // Touches that land outside every hole are still tracked so they can
      // slide into a hole later.
      activeTouches.current.set(touchId, active);
      if (!note) return;

      // noteStartHoldMs === 0 (a plucked instrument like the Kalimba):
      // sound immediately on touch-down, no hold delay at all.
      if (noteStartHoldMs <= 0) {
        startNoteForTouch(touchId, active);
        return;
      }

      active.startTimer = setTimeout(() => {
        active.startTimer = undefined;
        // Only start if this touch is still down and still aimed at a hole.
        if (activeTouches.current.get(touchId) === active && active.note) {
          startNoteForTouch(touchId, active);
        }
      }, noteStartHoldMs);
    },
    [findHoleDegreeAtPoint, getPlayableNote, isCalibrationMode, noteStartHoldMs, startNoteForTouch]
  );

  const handleTouchMove = useCallback(
    (touch: NativeTouchEvent) => {
      if (isCalibrationMode) return;
      const touchId = String(touch.identifier);
      const active = activeTouches.current.get(touchId);
      if (!active) return;

      const degree = findHoleDegreeAtPoint(touch.locationX, touch.locationY);
      // Same hole (or still in the gap between holes): never retrigger.
      // Leaving a hole keeps the current note sounding (legato) until the
      // finger reaches a different hole or lifts.
      if (!degree || degree === active.degree) return;

      const note = getPlayableNote(degree);
      if (!note) return;

      active.degree = degree;
      active.note = note;

      if (active.isSounding) {
        startNoteForTouch(touchId, active);
        return;
      }

      // Not sounding yet. A pending start timer just retargets to the new
      // hole (it reads active.note when it fires). Otherwise start now if the
      // quick-tap window already passed, or schedule the remainder of it.
      // (noteStartHoldMs === 0 always takes this immediate branch, since
      // elapsed >= 0 is always true.)
      if (active.startTimer) return;
      const elapsed = Date.now() - active.startedAt;
      if (elapsed >= noteStartHoldMs) {
        startNoteForTouch(touchId, active);
        return;
      }
      active.startTimer = setTimeout(() => {
        active.startTimer = undefined;
        if (activeTouches.current.get(touchId) === active && active.note) {
          startNoteForTouch(touchId, active);
        }
      }, noteStartHoldMs - elapsed);
    },
    [findHoleDegreeAtPoint, getPlayableNote, isCalibrationMode, noteStartHoldMs, startNoteForTouch]
  );

  const handleTouchEnd = useCallback(
    (touch: NativeTouchEvent) => {
      if (isCalibrationMode) return;
      stopTouchById(String(touch.identifier));
    },
    [isCalibrationMode, stopTouchById]
  );

  const saveCalibration = useCallback(async () => {
    const saved = await calibrationStore.saveCalibration(holes);
    setSavedHoles(saved.holes);
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, [calibrationStore, holes]);

  const resetCalibration = useCallback(async () => {
    const reset = await calibrationStore.resetCalibration();
    setHoles(reset.holes);
    setSavedHoles(reset.holes);
  }, [calibrationStore]);

  const exitCalibration = useCallback(() => {
    setIsCalibrationMode(false);
    setHoles(savedHoles);
    onExitCalibration?.();
  }, [onExitCalibration, savedHoles]);

  const updateHole = useCallback((degree: number, updater: (hole: CalibratedPad) => CalibratedPad) => {
    setHoles((current) => current.map((hole) => (hole.degree === degree ? updater(hole) : hole)));
  }, []);

  const calibrationResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => isCalibrationMode,
        onMoveShouldSetPanResponder: () => isCalibrationMode,
        onPanResponderMove: (event) => {
          if (!frame || !calibrationGesture.current) return;

          const { degree, mode: dragMode } = calibrationGesture.current;
          const touch = event.nativeEvent;
          const sourcePoint = containerPointToSource(touch.locationX, touch.locationY, frame);

          updateHole(degree, (hole) => {
            if (dragMode === "move") {
              return {
                ...hole,
                sourceX: sourcePoint.sourceX,
                sourceY: sourcePoint.sourceY
              };
            }

            const dx = sourcePoint.sourceX - hole.sourceX;
            const dy = sourcePoint.sourceY - hole.sourceY;

            // Rectangle: the handle drags from center to corner, so its
            // horizontal/vertical offsets set width and height independently
            // (a standard corner-resize handle), instead of one radius.
            if (isRectangle) {
              const nextHalfWidth = Math.max(20, Math.min(200, Math.abs(dx)));
              const nextHalfHeight = Math.max(20, Math.min(300, Math.abs(dy)));
              return {
                ...hole,
                hitRadius: nextHalfWidth,
                hitHeight: nextHalfHeight,
                visibleRadius: nextHalfWidth * 0.82,
                visibleHeight: nextHalfHeight * 0.82
              };
            }

            const nextRadius = Math.max(36, Math.min(150, Math.sqrt(dx * dx + dy * dy)));
            return {
              ...hole,
              visibleRadius: nextRadius * 0.72,
              hitRadius: nextRadius
            };
          });
        },
        onPanResponderRelease: () => {
          calibrationGesture.current = null;
        },
        onPanResponderTerminate: () => {
          calibrationGesture.current = null;
        }
      }),
    [frame, isCalibrationMode, isRectangle, updateHole]
  );

  return (
    <View
      style={styles.root}
      onLayout={handleLayout}
      onTouchStart={(event) => event.nativeEvent.changedTouches.forEach(handleTouchStart)}
      onTouchMove={(event) => event.nativeEvent.changedTouches.forEach(handleTouchMove)}
      onTouchEnd={(event) => event.nativeEvent.changedTouches.forEach(handleTouchEnd)}
      onTouchCancel={(event) => event.nativeEvent.changedTouches.forEach(handleTouchEnd)}
    >
      <ImageBackground source={imageSource} resizeMode="cover" style={styles.image}>
        {frame
          ? holes.map((hole) => {
              const point = sourcePointToContainer(hole.sourceX, hole.sourceY, frame);
              const halfWidth = hole.hitRadius * frame.scale;
              const halfHeight = (isRectangle ? hole.hitHeight ?? hole.hitRadius : hole.hitRadius) * frame.scale;

              return (
                <View key={hole.degree} pointerEvents="box-none" style={StyleSheet.absoluteFill}>
                  {isCalibrationMode ? (
                    <View
                      {...calibrationResponder.panHandlers}
                      pointerEvents="auto"
                      onTouchStart={() => {
                        calibrationGesture.current = { degree: hole.degree, mode: "move" };
                      }}
                      style={[
                        styles.calibrationZone,
                        {
                          left: point.x - halfWidth,
                          top: point.y - halfHeight,
                          width: halfWidth * 2,
                          height: halfHeight * 2,
                          borderRadius: isRectangle ? 8 : halfWidth
                        }
                      ]}
                    >
                      <Text style={styles.calibrationNumber}>{hole.degree}</Text>
                      <View
                        pointerEvents="auto"
                        onTouchStart={(event) => {
                          event.stopPropagation();
                          calibrationGesture.current = { degree: hole.degree, mode: "resize" };
                        }}
                        style={styles.resizeHandle}
                      />
                    </View>
                  ) : null}
                </View>
              );
            })
          : null}

        {isCalibrationMode ? (
          <View style={styles.controls}>
            <Pressable style={styles.controlButton} onPress={saveCalibration}>
              <Text style={styles.controlText}>Save</Text>
            </Pressable>
            <Pressable style={styles.controlButton} onPress={resetCalibration}>
              <Text style={styles.controlText}>Reset</Text>
            </Pressable>
            <Pressable style={styles.controlButton} onPress={exitCalibration}>
              <Text style={styles.controlText}>Exit Calibration</Text>
            </Pressable>
          </View>
        ) : null}
      </ImageBackground>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#020302"
  },
  image: {
    flex: 1
  },
  calibrationZone: {
    alignItems: "center",
    backgroundColor: "rgba(44, 227, 185, 0.08)",
    borderColor: "rgba(95, 255, 212, 0.95)",
    borderWidth: 2,
    justifyContent: "center",
    position: "absolute"
  },
  calibrationNumber: {
    color: "#effff8",
    fontSize: 22,
    fontWeight: "900",
    textShadowColor: "rgba(0, 0, 0, 0.8)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 5
  },
  resizeHandle: {
    position: "absolute",
    right: -11,
    bottom: -11,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#5fffd4",
    borderColor: "#08241e",
    borderWidth: 2
  },
  controls: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 28,
    flexDirection: "row",
    gap: 8,
    justifyContent: "center"
  },
  controlButton: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(8, 16, 13, 0.82)",
    borderColor: "rgba(255, 239, 206, 0.28)",
    borderWidth: 1
  },
  controlText: {
    color: "#fff0cf",
    fontWeight: "900",
    fontSize: 13
  }
});
