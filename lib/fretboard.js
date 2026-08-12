// Shared fretboard primitives used by modes.html and scales.html: standard
// tuning/geometry constants, the CAGED pentatonic box shapes, the low-level
// SVG string builder, the "finalize a shape" / "render a shape" helpers, the
// full-fretboard renderer, and the shared "render a scale/mode's whole output
// panel" orchestrator. Depends on noteIndex/NOTES from theory.js. Each page
// keeps its own higher-level shape computation (computeModalBoxes vs.
// computeShapes, buildNoteInfo, etc.) and degreeColor (different palettes)
// local, since those differ — this file only holds what both pages do
// identically.

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

// Returns the five CAGED pentatonic boxes for the given pentatonic-minor-
// shaped root, each placed at its lowest position that avoids open strings,
// then ordered ascending up the neck. A box that would otherwise fall in
// open position is wrapped up an octave, so the set always starts as low as
// possible without open strings. modes.html calls this directly with its
// modal anchor pc; scales.html calls it (as pentatonicBoxesForMinorRoot used
// to) via its own pentatonicBoxes(rootPc, isMajor) wrapper, which resolves a
// major root to its relative-minor anchor first — the algorithm itself is
// agnostic to major/minor, it just needs a root pitch class to anchor on.
function pentatonicBoxesForRoot(rootPc) {
  const base = ((rootPc - noteIndex('E')) % 12 + 12) % 12; // low-E fret of root
  const natural = PENT_BOXES_REL.map(box => {
    let frets = box.map(stringFrets => stringFrets.map(rel => rel + base));
    if (Math.min(...frets.flat()) < 1) {
      frets = box.map(stringFrets => stringFrets.map(rel => rel + base + 12));
    }
    return frets;
  });
  // A box that starts past fret 12 is a candidate to wrap an octave down
  // toward the nut (the identical shape recurs every 12 frets). Only wrap
  // when the lower placement avoids open strings and doesn't substantially
  // overlap a box already chosen, so positions stay distinct across the neck.
  const chosen = [];
  for (const frets of natural) {
    let final = frets;
    if (Math.min(...frets.flat()) > 12) {
      const wrapped = frets.map(stringFrets => stringFrets.map(f => f - 12));
      const wrappedMin = Math.min(...wrapped.flat());
      const overlapsChosen = chosen.some(other => fretRangeOverlap(wrapped, other) > 1);
      if (wrappedMin >= 1 && !overlapsChosen) final = wrapped;
    }
    chosen.push(final);
  }
  chosen.sort((a, b) => Math.min(...a.flat()) - Math.min(...b.flat()));
  return chosen.map(frets => ({ anchor: Math.min(...frets[0]), frets }));
}

// Which frets in [lo, hi] on each string sound a note in scaleNotes — the
// generic "fill this fret window with a scale" scan underlying
// diatonicBoxFromPentatonicBox() below.
function fillWindow(scaleNotes, lo, hi) {
  const frets = [];
  for (let s = 0; s < NUM_STRINGS; s++) {
    const stringFrets = [];
    for (let f = lo; f <= hi; f++) {
      if (scaleNotes.includes(getFretNote(s, f))) stringFrets.push(f);
    }
    frets.push(stringFrets);
  }
  return frets;
}

function underfilledCount(frets) {
  return frets.filter(sf => sf.length < 3).length;
}

// Before including a note at the highest fret on a string, check whether
// that same pitch will already appear at the lowest fret on the next string
// up. If so, drop it from the current (lower) string — otherwise the same
// physical pitch shows up twice, once on each of two adjacent strings, which
// reads as a duplicated note on the diagram.
function dedupeAdjacentStrings(frets) {
  const result = frets.map(sf => [...sf]);
  for (let s = 0; s < NUM_STRINGS - 1; s++) {
    const cur = result[s], next = result[s + 1];
    if (!cur.length || !next.length) continue;
    const curHighPitch = OPEN_ABS[s] + cur[cur.length - 1];
    const nextLowPitch = OPEN_ABS[s + 1] + next[0];
    if (curHighPitch === nextLowPitch) cur.pop();
  }
  return result;
}

// Diatonic (7-note) box fill: starts from the given pentatonic box's own
// fret window, then widens it until every string has a full 3 notes, before
// falling back to whatever it can get within a reasonable hand stretch.
//
// A raw pentatonic-sized window (tuned for 2 notes/string) is occasionally a
// fret too narrow to fully capture a 7-note scale — some strings then end up
// with only 1-2 notes instead of the expected 3 (e.g. E Phrygian's 4th
// position was missing F on the low E string, which sat just past the
// window's edge). This widens the window a fret at a time, preferring
// upward (the natural direction to reach for one more note) and falling
// back to downward, until every string reaches 3 notes or the window hits
// maxSpan — keeping the position within a reasonable hand stretch.
//
// Shared by modes.html (every mode of a key uses the same 7 pitches, so this
// runs once per parent key and is cached) and scales.html (major/minor
// Diatonic type, recomputed per selection).
function diatonicBoxFromPentatonicBox(scaleNotes, box, maxSpan = 5) {
  const all = box.frets.flat();
  const lo = Math.min(...all), hi = Math.max(...all);
  const originalFrets = fillWindow(scaleNotes, lo, hi);

  let wideLo = lo, wideHi = hi;
  while (underfilledCount(fillWindow(scaleNotes, wideLo, wideHi)) > 0 && (wideHi - wideLo) < maxSpan) {
    wideHi += 1;
  }
  while (underfilledCount(fillWindow(scaleNotes, wideLo, wideHi)) > 0 && (wideHi - wideLo) < maxSpan && wideLo > 1) {
    wideLo -= 1;
  }
  const widenedFrets = fillWindow(scaleNotes, wideLo, wideHi);

  // Only apply the wider window to strings that actually needed it —
  // strings that already had 3 notes in the original window keep those
  // exact notes, so widening never pads an already-complete string with an
  // unwanted 4th.
  const frets = originalFrets.map((orig, s) => orig.length >= 3 ? orig : widenedFrets[s].slice(0, 3));

  return dedupeAdjacentStrings(frets);
}

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
  s += `<rect width="${W}" height="${H}" fill="#101623"/>`;

  if (startFret === 0) {
    s += `<rect x="${LP-4}" y="${TP}" width="5" height="${(NUM_STRINGS-1)*SS}" fill="#e8edf7" rx="1"/>`;
  } else {
    s += `<text x="${LP-6}" y="${TP+(NUM_STRINGS-1)*SS/2+4}" text-anchor="end" font-family="DM Mono,monospace" font-size="${compact?9:10}" fill="#7488ac">${startFret}fr</text>`;
  }

  for (let f = 1; f <= numFrets; f++) {
    const x = LP + f * FS;
    s += `<line x1="${x}" y1="${TP}" x2="${x}" y2="${TP+(NUM_STRINGS-1)*SS}" stroke="#3d4d75" stroke-width="1.5"/>`;
  }

  for (const fm of FRET_MARKERS) {
    if (fm < startFret || fm > endFret) continue;
    const x = LP + (fm - startFret - 0.5) * FS;
    const midY = TP + ((NUM_STRINGS-1)*SS)/2;
    if (DOUBLE_DOT.includes(fm)) {
      s += `<circle cx="${x}" cy="${midY-SS}" r="4" fill="#2c3a5e"/>`;
      s += `<circle cx="${x}" cy="${midY+SS}" r="4" fill="#2c3a5e"/>`;
    } else {
      s += `<circle cx="${x}" cy="${midY}" r="4" fill="#2c3a5e"/>`;
    }
    s += `<text x="${x}" y="${H-(compact?3:5)}" text-anchor="middle" font-family="DM Mono,monospace" font-size="${compact?9:10}" fill="#4a5d85">${fm}</text>`;
  }

  for (let i = 0; i < NUM_STRINGS; i++) {
    const y = TP + (NUM_STRINGS - 1 - i) * SS;
    const thick = 1 + (NUM_STRINGS - 1 - i) * 0.3;
    s += `<line x1="${LP}" y1="${y}" x2="${LP+numFrets*FS}" y2="${y}" stroke="#c4b896" stroke-width="${thick}" opacity="0.7"/>`;
    if (!compact) {
      s += `<text x="${LP-10}" y="${y+4}" text-anchor="middle" font-family="DM Mono,monospace" font-size="10" fill="#7488ac">${OPEN_NOTES[i]}</text>`;
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

// The "Full" output mode: every scale-tone dot across the whole 0-15 fret
// range. noteInfo is the pitch-class-name -> {note, isRoot, color} lookup
// each page builds via its own buildNoteInfo().
function renderFullFretboard(scaleNotes, noteInfo) {
  const dots = [];
  for (let str = 0; str < NUM_STRINGS; str++) {
    for (let f = 0; f <= 15; f++) {
      const note = getFretNote(str, f);
      if (scaleNotes.includes(note)) {
        dots.push(makeDot(str, f, noteInfo));
      }
    }
  }
  return buildFretboardSVG(dots, { startFret: 0, endFret: 15, compact: false });
}

// The note-badge row shown above the fretboard/shapes output — the root
// badge highlighted, every badge titled with its scale-degree name.
// items: [{ name, color, title }], in display order (root first).
function buildNoteBadgesHTML(items) {
  return items.map((item, i) => {
    const cls = i === 0 ? 'note-badge root' : 'note-badge';
    const textColor = i === 0 ? '#0f0e0c' : '#e8e0d0';
    return `<span class="${cls}" title="${item.title}" style="background:${item.color};color:${textColor};">${item.name}</span>`;
  }).join('');
}

// One colored-dot row in the legend panel below the output.
function legendItemHTML(color, label) {
  return `<div class="legend-item"><div class="legend-dot" style="background:${color}"></div>${label}</div>`;
}

// Renders the whole output panel — header, note badges, either the full
// fretboard or the positional-shapes grid, and the legend — shared by
// modes.html and scales.html's generate() functions, which differ only in
// their title text and how they compute shapes.
//
//   title — e.g. "G Mixolydian" or "C Major Pentatonic".
//   noteBadgesHTML, legendHTML — pre-built via buildNoteBadgesHTML() and
//     legendItemHTML() (joined into a `<div class="legend">...</div>`).
//   shapesMode — false shows the full fretboard, true shows positional shapes.
//   scaleNotes, noteInfo — passed through to renderFullFretboard().
//   computeShapes() — zero-arg callback returning the shapes array; only
//     called (and only needs to be cheap) when shapesMode is true.
function renderScaleOutput({
  outputId = 'output',
  title,
  noteBadgesHTML,
  legendHTML,
  shapesMode,
  scaleNotes,
  noteInfo,
  computeShapes,
}) {
  const output = document.getElementById(outputId);
  output.innerHTML = '';

  const hdr = document.createElement('div');
  hdr.className = 'output-header';
  hdr.innerHTML = `
    <h2>${title}</h2>
    <div class="subtitle">${shapesMode ? 'Positional shapes · standard tuning (EADGBe)' : 'Full fretboard · standard tuning (EADGBe)'}</div>
  `;
  output.appendChild(hdr);

  const nr = document.createElement('div');
  nr.className = 'notes-row';
  nr.style.cssText = 'max-width:980px;margin:0 auto 24px;';
  nr.innerHTML = noteBadgesHTML;
  output.appendChild(nr);

  if (!shapesMode) {
    const card = document.createElement('div');
    card.className = 'diagram-card';
    card.innerHTML = `<div class="fretboard-scroll">${renderFullFretboard(scaleNotes, noteInfo)}</div>`;
    output.appendChild(card);
  } else {
    const shapes = computeShapes();

    const countLbl = document.createElement('div');
    countLbl.className = 'shapes-count-label';
    countLbl.textContent = `${shapes.length} positions · standard tuning`;
    output.appendChild(countLbl);

    const grid = document.createElement('div');
    grid.className = 'shapes-grid';

    shapes.forEach(shape => {
      const card = document.createElement('div');
      card.className = 'diagram-card shape-card';
      card.innerHTML = `
        <div class="shape-title">${shape.label}</div>
        <div class="subtitle">${shape.sublabel}</div>
        <div class="fretboard-scroll">${renderShape(shape)}</div>
      `;
      grid.appendChild(card);
    });

    output.appendChild(grid);
  }

  const legendPanel = document.createElement('div');
  legendPanel.className = 'legend-panel';
  legendPanel.innerHTML = `<div class="legend-title">Legend</div>${legendHTML}`;
  output.appendChild(legendPanel);
}
