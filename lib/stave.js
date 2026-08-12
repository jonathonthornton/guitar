// Shared treble-clef stave renderer used by modes.html and scales.html.
// Depends on createSVGElement from svg-utils.js, and on each page's own
// degreeColor(index, degreeNames) — the note-color palette differs per page
// (modes.html's modal degree names vs. scales.html's scale/chord degree
// names), so that lookup stays page-local rather than living here.

const STAVE_SCALE = 4 / 3;      // vertical growth factor (staff ~1/3 taller)
const STAVE_LINE_SPACING = 12 * STAVE_SCALE; // px between adjacent staff lines
const STAVE_BOTTOM_Y = 96 * STAVE_SCALE;     // y of bottom line (E4, step 0)
const STAVE_LEFT_X = 10;
const STAVE_RIGHT_X = 504;

// Vertical staff position (0 = bottom line E4, +1 per half-step up the staff)
// for each letter's accidental symbol, per standard treble-clef convention.
const SHARP_STAFF_POS = { F: 8, C: 5, G: 9, D: 6, A: 3, E: 7, B: 4 };
const FLAT_STAFF_POS  = { B: 4, E: 7, A: 3, D: 6, G: 2, C: 5, F: 1 };

function stepY(step) {
  return STAVE_BOTTOM_Y - step * (STAVE_LINE_SPACING / 2);
}

function drawLedgerLines(svg, x, step) {
  const halfWidth = 9 * STAVE_SCALE;
  const strokeWidth = 1.5 * STAVE_SCALE;
  if (step <= -2) {
    for (let s = -2; s >= step; s -= 2) {
      svg.appendChild(createSVGElement('line', {
        x1: x - halfWidth, y1: stepY(s), x2: x + halfWidth, y2: stepY(s),
        stroke: '#3d4d75', 'stroke-width': strokeWidth,
      }));
    }
  } else if (step >= 10) {
    for (let s = 10; s <= step; s += 2) {
      svg.appendChild(createSVGElement('line', {
        x1: x - halfWidth, y1: stepY(s), x2: x + halfWidth, y2: stepY(s),
        stroke: '#3d4d75', 'stroke-width': strokeWidth,
      }));
    }
  }
}

// Draws the 5 staff lines, clef, key-signature accidentals, and a row of
// quarter notes for `notes`, then (optionally) fills in the caption below.
//
//   sig — a getKeySignature() result: { tonicName, type, letters }.
//   notes — array of { step, letter, accidental }, in the shape returned by
//     modalStaffNotes()/getScaleStaffNotes(); pass [] to draw an empty stave.
//   degreeNames — parallel array used with the caller's own
//     degreeColor(index, degreeNames) to color each note by scale degree.
//   getLabelLines(outOfKeyNote) — optional callback returning the caption's
//     lines (or null/undefined to leave the label untouched). outOfKeyNote is
//     the last note drawn whose accidental didn't match what the key
//     signature implies for its letter (e.g. the blues scale's blue note) —
//     null if every note was in-key — so callers can mention it in the
//     caption the way scales.html does ("Blue note: ...").
function renderMusicStave({
  svgId = 'key-stave',
  labelId = 'stave-label',
  sig,
  notes = [],
  degreeNames,
  getLabelLines,
} = {}) {
  const svg = document.getElementById(svgId);
  const label = document.getElementById(labelId);
  if (!svg) return;
  svg.innerHTML = '';

  for (let i = 0; i < 5; i++) {
    const y = stepY(i * 2);
    svg.appendChild(createSVGElement('line', {
      x1: STAVE_LEFT_X, y1: y, x2: STAVE_RIGHT_X, y2: y,
      stroke: '#3d4d75', 'stroke-width': 1.5 * STAVE_SCALE,
    }));
  }

  const clef = createSVGElement('text', {
    x: STAVE_LEFT_X + 6, y: stepY(2) + 32 * STAVE_SCALE - STAVE_LINE_SPACING,
    'font-size': 100 * STAVE_SCALE,
    'font-family': "'Bravura Text','Noto Music','Apple Symbols','Segoe UI Symbol',serif",
    fill: '#e0a940',
  });
  clef.textContent = '\u{1D11E}';
  svg.appendChild(clef);

  const symbol = sig.type === 'sharp' ? '♯' : '♭';
  const positions = sig.type === 'sharp' ? SHARP_STAFF_POS : FLAT_STAFF_POS;
  let x = STAVE_LEFT_X + 70;
  sig.letters.forEach(l => {
    const y = stepY(positions[l]);
    svg.appendChild(createSVGElement('text', {
      x, y: y + 6 * STAVE_SCALE,
      'text-anchor': 'middle',
      'font-size': 22 * STAVE_SCALE,
      'font-family': 'serif',
      fill: '#e8edf7',
    })).textContent = symbol;
    x += 18;
  });

  let outOfKeyNote = null;
  let nx = x + 16;
  notes.forEach((note, i) => {
    const y = stepY(note.step);
    const color = degreeColor(i, degreeNames);
    drawLedgerLines(svg, nx, note.step);

    // A note needs its own accidental whenever its pitch isn't what the key
    // signature already implies for that letter (e.g. the blues scale's
    // blue note, which is chromatic and outside the diatonic key). This
    // never fires for purely modal/diatonic note sets, since every note's
    // accidental is by construction exactly what the key signature implies.
    const impliedAccidental = sig.type === 'sharp' && sig.letters.includes(note.letter) ? 1
      : sig.type === 'flat' && sig.letters.includes(note.letter) ? -1
      : 0;
    if (note.accidental !== impliedAccidental) {
      const accSymbol = note.accidental === 1 ? '♯' : note.accidental === -1 ? '♭' : '♮';
      const displayName = note.accidental === 0 ? note.letter : note.letter + accSymbol;
      outOfKeyNote = { name: displayName, symbol: accSymbol };
      svg.appendChild(createSVGElement('text', {
        x: nx - 12 * STAVE_SCALE, y: y + 6 * STAVE_SCALE,
        'text-anchor': 'middle',
        'font-size': 19 * STAVE_SCALE,
        'font-family': 'serif',
        fill: color,
      })).textContent = accSymbol;
    }

    const rx = 6.5 * STAVE_SCALE;
    svg.appendChild(createSVGElement('ellipse', {
      cx: nx, cy: y, rx, ry: 5 * STAVE_SCALE,
      fill: color,
      transform: `rotate(-20 ${nx} ${y})`,
    }));

    const stemDown = note.step >= 4;
    const stemX = stemDown ? nx - rx : nx + rx;
    const stemLength = 30 * STAVE_SCALE;
    const stemY2 = stemDown ? y + stemLength : y - stemLength;
    svg.appendChild(createSVGElement('line', {
      x1: stemX, y1: y, x2: stemX, y2: stemY2,
      stroke: color, 'stroke-width': 1.6 * STAVE_SCALE,
    }));

    nx += 38;
  });

  if (label && getLabelLines) {
    const lines = getLabelLines(outOfKeyNote);
    if (lines) label.innerHTML = lines.map(line => `<div>${line}</div>`).join('');
  }
}
