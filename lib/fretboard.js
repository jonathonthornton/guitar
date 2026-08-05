// Shared fretboard primitives used by modes.html and scales.html: standard
// tuning/geometry constants, the CAGED pentatonic box shapes, the low-level
// SVG string builder, and the "finalize a shape" / "render a shape" helpers.
// Depends on noteIndex/NOTES from theory.js. Each page keeps its own
// higher-level shape computation (pentatonicBoxesForRoot vs.
// pentatonicBoxesForMinorRoot, buildNoteInfo, renderFullFretboard, etc.)
// since those differ in how they derive notes/anchors — this file only holds
// what both pages do identically.

const OPEN_NOTES = ['E','A','D','G','B','E'];
const OPEN_ABS = [0, 5, 10, 15, 19, 24]; // absolute semitone of each open string (low E = 0)
const NUM_STRINGS = 6;

function getFretNote(stringIdx, fret) {
  return NOTES[(noteIndex(OPEN_NOTES[stringIdx]) + fret) % 12];
}

// noteInfo: a pitch-class-name -> {note, isRoot, color} lookup, as built by
// each page's own buildNoteInfo(). Falls back to a plain chromatic label for
// any fret whose pitch class isn't in the current scale/mode.
function makeDot(s, f, noteInfo) {
  const chromatic = getFretNote(s, f);
  const info = noteInfo[chromatic] || { note: chromatic, isRoot: false, color: DEFAULT_TONE_COLOR };
  return { string: s, fret: f, note: info.note, isRoot: info.isRoot, color: info.color };
}

function fretRangeOverlap(a, b) {
  const aFlat = a.flat(), bFlat = b.flat();
  const aMin = Math.min(...aFlat), aMax = Math.max(...aFlat);
  const bMin = Math.min(...bFlat), bMax = Math.max(...bFlat);
  return Math.min(aMax, bMax) - Math.max(aMin, bMin);
}

// The five pentatonic "box" positions of the CAGED system, as canonical fixed
// shapes. Stored for A minor pentatonic (root A, Position 1 rooted at fret 5 on
// the low E string), then transposed to any key. These are the standard,
// widely-taught CAGED boxes — each is exactly two notes per string, connected
// and ascending up the neck.
const A_MINOR_PENT_BOXES = [
  [[5, 8], [5, 7], [5, 7], [5, 7], [5, 8], [5, 8]],
  [[8, 10], [7, 10], [7, 10], [7, 9], [8, 10], [8, 10]],
  [[10, 12], [10, 12], [10, 12], [9, 12], [10, 13], [10, 12]],
  [[12, 15], [12, 15], [12, 14], [12, 14], [13, 15], [12, 15]],
  [[15, 17], [15, 17], [14, 17], [14, 17], [15, 17], [15, 17]],
];
const A_MINOR_PENT_ROOT_FRET = 5; // fret of the Position-1 low-E root (A)
// Boxes expressed relative to the Position-1 low-E root fret, so they can be
// transposed by simply adding the target key's low-E root fret.
const PENT_BOXES_REL = A_MINOR_PENT_BOXES.map(box =>
  box.map(stringFrets => stringFrets.map(f => f - A_MINOR_PENT_ROOT_FRET)));

// Turns a set of per-string frets into a renderable shape: dots (via
// makeDot), its fret range, an anchor fret for the position label, and the
// label/sublabel text. anchorOverride lets a caller pin the anchor to a
// value other than the box's own lowest fret (scales.html uses this so
// blues/triad variants of the same box report the box's anchor, not
// whichever fret their filtered note set happens to start on).
function finalizeShape(frets, noteInfo, idx, anchorOverride) {
  const dots = [];
  frets.forEach((stringFrets, s) => {
    stringFrets.forEach(f => dots.push(makeDot(s, f, noteInfo)));
  });
  const fretNums = dots.map(d => d.fret).filter(f => f > 0);
  const minFret = fretNums.length ? Math.min(...fretNums) : 0;
  const maxFret = fretNums.length ? Math.max(...fretNums) : 4;
  const anchor = anchorOverride != null
    ? anchorOverride
    : (frets[0] && frets[0].length ? Math.min(...frets[0]) : minFret);
  const label = `Position ${idx + 1}`;
  const sublabel = anchor === 0 ? 'Open position' : `Fret ${anchor}`;
  return { label, sublabel, anchor, minFret, maxFret, dots };
}

// Renders `dots` onto a fretboard diagram spanning [startFret, endFret], as
// a raw SVG string (built by concatenation rather than the DOM, since this
// output is also cached/serialized as innerHTML by callers).
function buildFretboardSVG(dots, { startFret = 0, endFret = 15, compact = false } = {}) {
  const SS = compact ? 28 : 34;
  const FS = compact ? 40 : 52;
  const LP = compact ? 36 : 50;
  const TP = compact ? 22 : 30;
  const BP = compact ? 20 : 30;
  const DR = compact ? 11 : 13;

  const numFrets = endFret - startFret;
  const W = LP + numFrets * FS + (compact ? 16 : 28);
  const H = TP + (NUM_STRINGS - 1) * SS + BP;

  const FRET_MARKERS = [3,5,7,9,12,15];
  const DOUBLE_DOT = [12];

  let s = `<svg class="fretboard" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;
  s += `<rect width="${W}" height="${H}" fill="#1a1814"/>`;

  if (startFret === 0) {
    s += `<rect x="${LP-4}" y="${TP}" width="5" height="${(NUM_STRINGS-1)*SS}" fill="#e8e0d0" rx="1"/>`;
  } else {
    s += `<text x="${LP-6}" y="${TP+(NUM_STRINGS-1)*SS/2+4}" text-anchor="end" font-family="DM Mono,monospace" font-size="${compact?9:10}" fill="#7a7060">${startFret}fr</text>`;
  }

  for (let f = 1; f <= numFrets; f++) {
    const x = LP + f * FS;
    s += `<line x1="${x}" y1="${TP}" x2="${x}" y2="${TP+(NUM_STRINGS-1)*SS}" stroke="#4a4438" stroke-width="1.5"/>`;
  }

  for (const fm of FRET_MARKERS) {
    if (fm < startFret || fm > endFret) continue;
    const x = LP + (fm - startFret - 0.5) * FS;
    const midY = TP + ((NUM_STRINGS-1)*SS)/2;
    if (DOUBLE_DOT.includes(fm)) {
      s += `<circle cx="${x}" cy="${midY-SS}" r="4" fill="#2e2b25"/>`;
      s += `<circle cx="${x}" cy="${midY+SS}" r="4" fill="#2e2b25"/>`;
    } else {
      s += `<circle cx="${x}" cy="${midY}" r="4" fill="#2e2b25"/>`;
    }
    s += `<text x="${x}" y="${H-(compact?3:5)}" text-anchor="middle" font-family="DM Mono,monospace" font-size="${compact?9:10}" fill="#655c4e">${fm}</text>`;
  }

  for (let i = 0; i < NUM_STRINGS; i++) {
    const y = TP + (NUM_STRINGS - 1 - i) * SS;
    const thick = 1 + (NUM_STRINGS - 1 - i) * 0.3;
    s += `<line x1="${LP}" y1="${y}" x2="${LP+numFrets*FS}" y2="${y}" stroke="#c4b896" stroke-width="${thick}" opacity="0.7"/>`;
    if (!compact) {
      s += `<text x="${LP-10}" y="${y+4}" text-anchor="middle" font-family="DM Mono,monospace" font-size="10" fill="#7a7060">${OPEN_NOTES[i]}</text>`;
    }
  }

  for (const dot of dots) {
    const y = TP + (NUM_STRINGS - 1 - dot.string) * SS;
    const x = dot.fret === 0 ? LP - FS * 0.4 : LP + (dot.fret - startFret - 0.5) * FS;
    const fill = dot.color || (dot.isRoot ? '#e8b62d' : '#6e677e');
    s += `<circle cx="${x}" cy="${y}" r="${DR}" fill="${fill}" opacity="0.95"/>`;
    const fontSize = dot.note.length > 1 ? (compact?8:9) : (compact?9:11);
    const textFill = dot.isRoot ? '#0f0e0c' : '#e8e0d0';
    s += `<text x="${x}" y="${y+4}" text-anchor="middle" font-family="DM Mono,monospace" font-size="${fontSize}" font-weight="500" fill="${textFill}">${dot.note}</text>`;
  }

  s += '</svg>';
  return s;
}

// One extra fret on each side so notes at the edges (e.g. the blues b5) are
// never truncated and every diagram has consistent breathing room.
function renderShape(shape) {
  const hasOpen = shape.dots.some(d => d.fret === 0);
  const dispStart = hasOpen ? 0 : Math.max(0, shape.minFret - 1);
  const dispEnd = shape.maxFret + 1;
  return buildFretboardSVG(shape.dots, { startFret: dispStart, endFret: dispEnd, compact: true });
}
