// Diatonic-triad theory and 3-string voicing search/rendering, shared by
// chords.html and triad-position.html. Depends on NOTES, LETTERS,
// LETTER_SEMITONE, noteIndex, MAJOR_SCALE_INTERVALS, and MINOR_SCALE_INTERVALS
// from theory.js, so load this file after theory.js.
//
// Each page keeps its own higher-level chord-type dispatch local: chords.html
// additionally supports 7th/sus/dim/aug chords (its own interval tables and
// calculateTriadVoicing), while triad-position.html only ever needs plain
// triads but searches every string set within a chosen fret region
// (findTriadVoicingInRegion) rather than a single fixed string set.

// Maps a circle-of-fifths pitch-class name onto the "keyStr" format
// spellScale/chooseBestRoot expect (matches the old <select id="key-select">
// values both pages were originally built around).
const KEYSTR_MAP = {
  'C': 'C', 'C#': 'C#/Db', 'D': 'D', 'D#': 'D#/Eb', 'E': 'E', 'F': 'F',
  'F#': 'F#/Gb', 'G': 'G', 'G#': 'G#/Ab', 'A': 'A', 'A#': 'A#/Bb', 'B': 'B'
};

// Spell a scale so each degree uses the next letter name in sequence,
// adding the accidental needed to hit the correct pitch.
function spellScale(rootStr, intervals) {
  const rootPc = noteIndex(rootStr);
  const startLetterIdx = LETTERS.indexOf(rootStr[0]);
  return intervals.map((iv, i) => {
    const targetPc = (rootPc + iv) % 12;
    const letter = LETTERS[(startLetterIdx + i) % 7];
    const diff = (targetPc - LETTER_SEMITONE[letter] + 12) % 12;
    const acc = diff === 0 ? '' : diff === 1 ? '#' : diff === 2 ? '##'
              : diff === 11 ? 'b' : diff === 10 ? 'bb' : '?';
    return letter + acc;
  });
}

// When a key has two enharmonic names (e.g. "C#/Db"), pick the spelling
// with the fewest accidentals; heavily penalise double accidentals and,
// on an exact tie, prefer flats.
function chooseBestRoot(keyStr, intervals) {
  const candidates = keyStr.split('/');
  let best = candidates[0], bestScore = Infinity;
  for (const cand of candidates) {
    let score = 0;
    for (const n of spellScale(cand, intervals)) {
      const acc = n.slice(1);
      if (acc === '##' || acc === 'bb') score += 100;
      score += acc.length;
      if (acc.includes('#')) score += 0.1; // tie-break toward flats
    }
    if (score < bestScore) { bestScore = score; best = cand; }
  }
  return best;
}

// Spell a single chord tone using the correct letter name — the letter
// is `letterOffset` steps up the musical alphabet from the chord root's
// own letter (0 = same letter as root, 2 = a third up, etc.), with the
// accidental chosen to land on the required pitch class.
function spellChordTone(rootStr, letterOffset, targetPc) {
  const startLetterIdx = LETTERS.indexOf(rootStr[0]);
  const letter = LETTERS[(startLetterIdx + letterOffset) % 7];
  const diff = (targetPc - LETTER_SEMITONE[letter] + 12) % 12;
  const acc = diff === 0 ? '' : diff === 1 ? '#' : diff === 2 ? '##'
            : diff === 11 ? 'b' : diff === 10 ? 'bb' : '?';
  return letter + acc;
}

// ── Diatonic triads of a key ─────────────────────────────────────────────────

const MAJOR_QUALITIES = ['maj', 'min', 'min', 'maj', 'maj', 'min', 'dim'];
const MINOR_QUALITIES = ['min', 'dim', 'maj', 'min', 'min', 'maj', 'maj'];

const ROMAN_MAJOR = ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'];
const ROMAN_MINOR = ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'];

function getKeyRoot(keyStr, mode) {
  const intervals = mode === 'major' ? MAJOR_SCALE_INTERVALS : MINOR_SCALE_INTERVALS;
  return chooseBestRoot(keyStr, intervals);
}

function getScaleChords(keyStr, mode) {
  const intervals = mode === 'major' ? MAJOR_SCALE_INTERVALS : MINOR_SCALE_INTERVALS;
  const qualities = mode === 'major' ? MAJOR_QUALITIES : MINOR_QUALITIES;
  const root = chooseBestRoot(keyStr, intervals);
  return spellScale(root, intervals).map((note, i) => ({
    note,
    quality: qualities[i]
  }));
}

// ── String set definitions ─────────────────────────────────────────────────────
// Open string pitches (note indices)

const STRING_SETS = {
  EAD: {
    openNotes: [4, 9, 2],   // E, A, D
    labels: ['E', 'A', 'D'],
    stringIndices: [0, 1, 2]  // Position on full 6-string guitar
  },
  ADG: {
    openNotes: [9, 2, 7],   // A, D, G
    labels: ['A', 'D', 'G'],
    stringIndices: [1, 2, 3]
  },
  DGB: {
    openNotes: [2, 7, 11],  // D, G, B
    labels: ['D', 'G', 'B'],
    stringIndices: [2, 3, 4]
  },
  GBe: {
    openNotes: [7, 11, 4],  // G, B, e
    labels: ['G', 'B', 'e'],
    stringIndices: [3, 4, 5]
  }
};

const TRIAD_INTERVALS = {
  maj: [0, 4, 7],   // root, major 3rd, perfect 5th
  min: [0, 3, 7],   // root, minor 3rd, perfect 5th
  dim: [0, 3, 6]    // root, minor 3rd, diminished 5th
};

// ── Voicing construction helpers ─────────────────────────────────────────────

// Rotates a [root, third, fifth]-ordered 3-element array to the given
// inversion's playing order: 0 = root position (unchanged), 1 = first
// inversion (3rd-5th-root), 2 = second inversion (5th-root-3rd). Used to
// reorder a chord's notes/role names/note names together, in lockstep.
function rotateForInversion(arr, inversion) {
  return [arr[inversion % 3], arr[(inversion + 1) % 3], arr[(inversion + 2) % 3]];
}

// Raw (unoctaved, 0–11) fret for each string that produces the given note,
// given that string set's open-string pitch classes.
function fretsFromOpenNotes(orderedNotes, openNotes) {
  return orderedNotes.map((targetNote, i) => (targetNote - openNotes[i] + 12) % 12);
}

// ── UI helpers ─────────────────────────────────────────────────────────────────

// chordType is optional — omit it (as triad-position.html does) for the plain
// maj/min/dim triad naming in the final `else` branch.
function formatChordName(note, quality, chordType) {
  if (chordType === 'maj7') {
    if (quality === 'maj') return note + ' maj 7';
    if (quality === 'min') return note + 'm 7';
    return note + 'ø 7';
  } else if (chordType === 'dom7') {
    if (quality === 'maj') return note + ' 7';
    if (quality === 'min') return note + 'm 7';
    return note + '° 7';
  } else if (chordType === 'sus2') {
    return note + ' sus 2';
  } else if (chordType === 'sus4') {
    return note + ' sus 4';
  } else if (chordType === 'dim') {
    return note + '°';
  } else if (chordType === 'aug') {
    return note + '+';
  } else {
    if (quality === 'maj') return note;
    if (quality === 'min') return note + 'm';
    return note + '°';
  }
}

// ── SVG triad diagram ──────────────────────────────────────────────────────────
// A compact 3-string fretboard diagram for one voicing — distinct from
// fretboard.js's buildFretboardSVG (6 strings, 0-15 frets): this one always
// spans exactly 3 strings and grows its fret window to fit whatever voicing
// it's given.

function drawTriadDiagram(voicing) {
  if (!voicing) {
    return `<div class="no-chord">No voicing</div>`;
  }

  const { frets, stringLabels, noteRoles, noteNames } = voicing;

  const playedNonZero = frets.filter(f => f > 0);
  const minFret = playedNonZero.length ? Math.min(...playedNonZero) : 0;
  const maxFret = Math.max(...frets);

  const hasOpenStrings = frets.some(f => f === 0);
  const isOpenPosition = hasOpenStrings && maxFret <= 4;
  const startFret = isOpenPosition ? 1 : Math.max(1, minFret);

  // The window needs to reach whichever fretted note sits highest above
  // startFret. Default to 5 frets (the normal comfortable-stretch case)
  // and only grow it for voicings that genuinely need more room, rather
  // than clipping notes that fall outside a fixed window.
  const framesNeeded = Math.max(0, maxFret - startFret) + 1;
  const nFrets = Math.max(5, framesNeeded);

  const W = 100, H = 140;
  const mL = 38, mT = 32, mR = 12, mB = 24;
  const gridW = W - mL - mR;
  const gridH = H - mT - mB;
  const nStr = 3;
  const ssp = gridW / (nStr - 1);
  const fsp = gridH / nFrets;
  const dotR = 9, oR = 6;

  let svg = [];
  const hasNut = startFret === 1;
  const topY = mT + (hasNut ? 4 : 0);

  // Nut or fret number
  if (hasNut) {
    svg.push(`<rect x="${mL}" y="${mT}" width="${gridW}" height="4" fill="#c9a84c"/>`);
  } else {
    svg.push(`<text x="${mL - 12}" y="${mT + fsp * 0.7}" text-anchor="end" font-family="DM Mono,monospace" font-size="10" fill="#7a7060">${startFret}fr</text>`);
  }

  // Fret lines
  for (let f = 0; f <= nFrets; f++) {
    if (f === 0 && hasNut) continue;
    const y = topY + f * fsp;
    svg.push(`<line x1="${mL}" y1="${y}" x2="${mL + gridW}" y2="${y}" stroke="#2e2b25" stroke-width="1"/>`);
  }

  // String lines
  const bottomY = topY + nFrets * fsp;
  for (let s = 0; s < nStr; s++) {
    const x = mL + s * ssp;
    svg.push(`<line x1="${x}" y1="${topY}" x2="${x}" y2="${bottomY}" stroke="#5a5040" stroke-width="1.2"/>`);
  }

  // Color mapping for note roles
  const roleColors = {
    root: '#c9a84c',
    third: '#6a9fb5',
    fifth: '#8b5e3c',
    seventh: '#7b68a6',
    sus: '#6ab57a'
  };

  // Text color chosen for contrast against each fill color
  const roleTextColors = {
    root: '#0f0e0c',
    third: '#e8e0d0',
    fifth: '#e8e0d0',
    seventh: '#e8e0d0',
    sus: '#0f0e0c'
  };

  // Fretted/open markers, each labelled with its note letter
  frets.forEach((fret, i) => {
    const x = mL + i * ssp;
    const color = roleColors[noteRoles[i]];
    const noteName = noteNames[i];
    const labelSize = noteName.length <= 1 ? 8 : noteName.length === 2 ? 7 : 5.5;

    if (fret === 0) {
      svg.push(`<circle cx="${x}" cy="${mT - 10}" r="${oR}" fill="var(--bg)" stroke="${color}" stroke-width="2"/>`);
      svg.push(`<text x="${x}" y="${mT - 10}" text-anchor="middle" dominant-baseline="central" font-family="DM Mono,monospace" font-size="${labelSize - 1}" font-weight="500" fill="${color}">${noteName}</text>`);
    } else {
      const rf = fret - startFret + 1;
      const y = topY + (rf - 0.5) * fsp;
      if (y >= topY - 1 && y <= bottomY + 1) {
        svg.push(`<circle cx="${x}" cy="${y}" r="${dotR}" fill="${color}"/>`);
        svg.push(`<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="DM Mono,monospace" font-size="${labelSize}" font-weight="600" fill="${roleTextColors[noteRoles[i]]}">${noteName}</text>`);
      }
    }
  });

  // String labels at bottom
  stringLabels.forEach((n, i) => {
    svg.push(`<text x="${mL + i * ssp}" y="${H - 4}" text-anchor="middle" font-family="DM Mono,monospace" font-size="9" fill="#5a5040">${n}</text>`);
  });

  return `<svg class="chord-svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${svg.join('')}</svg>`;
}
