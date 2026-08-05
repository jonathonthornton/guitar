// Shared music-theory engine used across chords.html, modes.html, and
// scales.html: pitch-class lookup, diatonic spelling, and key-signature
// derivation. Page-specific scale/chord data (interval formulas, degree
// names, colors) stays local to each page.

const NOTES = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];

const LETTERS = ['C','D','E','F','G','A','B'];
const LETTER_SEMITONE = { C:0, D:2, E:4, F:5, G:7, A:9, B:11 };
const LETTER_INDEX = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 };

// Robust pitch-class lookup: handles naturals, #, b, ## and bb.
function noteIndex(note) {
  let pc = LETTER_SEMITONE[note[0]];
  for (const ch of note.slice(1)) {
    if (ch === '#') pc += 1;
    else if (ch === 'b') pc -= 1;
  }
  return ((pc % 12) + 12) % 12;
}

// Conventional tonic spelling for each internal key name (matches the
// enharmonic spelling shown on the circle of fifths), per key quality.
const ROOT_SPELLING_MAJOR = {
  'C':  ['C', 0], 'G':  ['G', 0], 'D':  ['D', 0], 'A':  ['A', 0],
  'E':  ['E', 0], 'B':  ['B', 0], 'F#': ['F', 1], 'C#': ['D', -1],
  'G#': ['A', -1], 'D#': ['E', -1], 'A#': ['B', -1], 'F':  ['F', 0],
};
const ROOT_SPELLING_MINOR = {
  'A':  ['A', 0], 'E':  ['E', 0], 'B':  ['B', 0], 'F#': ['F', 1],
  'C#': ['C', 1], 'G#': ['G', 1], 'D#': ['D', 1], 'A#': ['B', -1],
  'F':  ['F', 0], 'C':  ['C', 0], 'G':  ['G', 0], 'D':  ['D', 0],
};

const MAJOR_SCALE_INTERVALS = [0,2,4,5,7,9,11];
const MINOR_SCALE_INTERVALS = [0,2,3,5,7,8,10];

// Spells a 7-note diatonic scale so each degree gets its own letter name,
// starting from `letter` (natural pitch class + `accidental` semitones).
function buildDiatonicScale(letter, accidental, formula) {
  const startIdx = LETTERS.indexOf(letter);
  const tonicSemitone = ((LETTER_SEMITONE[letter] + accidental) % 12 + 12) % 12;
  return formula.map((offset, step) => {
    const stepLetter = LETTERS[(startIdx + step) % 7];
    const natural = LETTER_SEMITONE[stepLetter];
    const target = (tonicSemitone + offset) % 12;
    let diff = (target - natural) % 12;
    if (diff > 6) diff -= 12;
    if (diff < -6) diff += 12;
    return { letter: stepLetter, accidental: diff };
  });
}

function formatSpelledNote({ letter, accidental }) {
  const symbol = accidental === 0 ? '' : accidental > 0 ? '#'.repeat(accidental) : 'b'.repeat(-accidental);
  return letter + symbol;
}

// General letter -> absolute staff step (0 = bottom line E4), for any octave.
function absoluteStaffStep(letter, octave) {
  return (octave * 7 + LETTER_INDEX[letter]) - 30; // 30 = C0-relative index of E4
}

// Standard order the accidentals appear in a written key signature.
const SHARP_ORDER = ['F', 'C', 'G', 'D', 'A', 'E', 'B'];
const FLAT_ORDER = ['B', 'E', 'A', 'D', 'G', 'C', 'F'];

function getKeySignature(root, keyType = 'major') {
  const table = keyType === 'minor' ? ROOT_SPELLING_MINOR : ROOT_SPELLING_MAJOR;
  const [letter, accidental] = table[root];
  const formula = keyType === 'minor' ? MINOR_SCALE_INTERVALS : MAJOR_SCALE_INTERVALS;
  const diatonic = buildDiatonicScale(letter, accidental, formula);
  const altered = diatonic.filter(e => e.accidental !== 0);
  const tonicName = accidental === 0 ? letter : letter + (accidental > 0 ? '♯'.repeat(accidental) : '♭'.repeat(-accidental));

  if (altered.length === 0) {
    return { tonicName, type: 'natural', letters: [] };
  }
  const type = altered[0].accidental > 0 ? 'sharp' : 'flat';
  const order = type === 'sharp' ? SHARP_ORDER : FLAT_ORDER;
  const present = new Set(altered.map(e => e.letter));
  const letters = order.filter(l => present.has(l));
  return { tonicName, type, letters };
}
