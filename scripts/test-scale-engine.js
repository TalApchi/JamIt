// Scale-degree correctness tests running against the REAL compiled sources.
const path = require("path");
const { compileForTests } = require("./lib/compile-for-tests");

const buildDir = compileForTests();
const { CHROMATIC_NOTES, SCALE_INTERVALS, generateScale } = require(path.join(buildDir, "music", "scaleEngine"));
const { generatePitchedScale, rootNoteToMidi } = require(path.join(buildDir, "music", "noteEngine"));

let failures = 0;
function check(label, condition) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL ${label}`);
  }
}

function assertPitchedScale(root, mode, expectedNames, expectedMidis) {
  const scale = generatePitchedScale(root, mode);
  const names = scale.map((degree) => degree.noteWithOctave).join(" ");
  const midis = scale.map((degree) => degree.midi).join(" ");
  check(`${root} ${mode} names: expected [${expectedNames.join(" ")}], got [${names}]`, names === expectedNames.join(" "));
  check(`${root} ${mode} midis: expected [${expectedMidis.join(" ")}], got [${midis}]`, midis === expectedMidis.join(" "));
}

// The four canonical examples from the product spec.
assertPitchedScale("C", "major", ["C4", "D4", "E4", "F4", "G4", "A4", "B4"], [60, 62, 64, 65, 67, 69, 71]);
assertPitchedScale("G", "major", ["G4", "A4", "B4", "C5", "D5", "E5", "F#5"], [67, 69, 71, 72, 74, 76, 78]);
assertPitchedScale("A", "minor", ["A4", "B4", "C5", "D5", "E5", "F5", "G5"], [69, 71, 72, 74, 76, 77, 79]);
assertPitchedScale("D", "major", ["D4", "E4", "F#4", "G4", "A4", "B4", "C#5"], [62, 64, 66, 67, 69, 71, 73]);

check("major intervals are 0,2,4,5,7,9,11", SCALE_INTERVALS.major.join(",") === "0,2,4,5,7,9,11");
check("minor intervals are 0,2,3,5,7,8,10", SCALE_INTERVALS.minor.join(",") === "0,2,3,5,7,8,10");

// Structural invariants for every root and both modes.
for (const root of CHROMATIC_NOTES) {
  for (const mode of ["major", "minor"]) {
    const scale = generateScale(root, mode);
    const pitched = generatePitchedScale(root, mode);
    const rootMidi = rootNoteToMidi(root);

    check(`${root} ${mode} has 7 degrees`, scale.length === 7 && pitched.length === 7);
    check(`${root} ${mode} starts on the root`, scale[0].note === root && pitched[0].midi === rootMidi);
    check(
      `${root} ${mode} midi = rootMidi + interval`,
      pitched.every((degree, i) => degree.midi === rootMidi + SCALE_INTERVALS[mode][i])
    );
    check(
      `${root} ${mode} is strictly ascending`,
      pitched.every((degree, i) => i === 0 || degree.midi > pitched[i - 1].midi)
    );
    check(
      `${root} ${mode} has 7 distinct pitches`,
      new Set(pitched.map((degree) => degree.midi)).size === 7
    );
  }
}

// Two different scales must NOT collapse to the same pitch set (the old bug:
// C major and A minor were the same 7 pitches).
const cMajor = generatePitchedScale("C", "major").map((d) => d.midi).sort().join(",");
const aMinor = generatePitchedScale("A", "minor").map((d) => d.midi).sort().join(",");
check("C major and A minor are different pitch sets", cMajor !== aMinor);

if (failures > 0) {
  console.error(`Scale engine tests FAILED (${failures} failure(s)).`);
  process.exit(1);
}
console.log("Scale engine tests passed: 4 spec scales + invariants for all 12 roots in Major and Natural Minor.");
