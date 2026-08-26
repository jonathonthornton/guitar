// String-set picker: a 6-string headstock/fretboard diagram, shared by
// chords.html and chord-explorer.html. Draws the tuners, fanned strings, and
// fretboard, then lets the user hover/click one of four overlapping 3-string
// groups (EAD, ADG, DGB, GBe).
//
// Unlike buildRegionPicker (lib/region-picker.js), this owns its own
// selection state (`lockedGroup`) and paints hover/lock highlighting
// directly — there's no separate paint*() the caller re-invokes after a
// selection change, since every state change here already originates from a
// DOM event this module itself is listening for.
//
// Expects the caller's HTML to provide (see chords.html for the exact static
// markup — headstock shape, nut, fretboard base rect, catcher rect — this
// geometry is built to match):
//   <svg id="board" viewBox="0 0 468 560">
//     <g id="headstock">
//       <path id="headstockShape" .../>
//       <g id="grain"></g>
//       <path id="logoArc" d="..."/>
//       <g id="logoText"></g>
//       <g id="tuners"></g>
//     </g>
//     <rect .../>                    nut
//     <g id="fanStrings"></g>
//     <g id="fretboard">
//       <rect .../>
//       <g id="frets"></g>
//     </g>
//     <rect id="hoverBand" .../>
//     <g id="strings"></g>
//     <g id="labels"></g>
//     <rect id="catcher" .../>
//   </svg>
//   <span id="readoutValue">G B e</span>          (matches the default group)

// ── Headstock logo (curved text) ─────────────────────────────────────────────
//
// Positioning each letter manually with plain <text> + rotate() (rather than
// a native <textPath> with textLength/lengthAdjust) sidesteps inconsistent
// per-glyph rendering across SVG engines — iOS WebKit in particular can apply
// a slight per-glyph rotation error that isn't present on desktop Chrome.

function renderHeadstockLogo() {
  const group = document.getElementById('logoText');
  const text = 'Jon Thornton';
  const targetWidth = 120; // matches the previous textLength
  const baseFontSize = 17;

  // Quadratic bezier control points, matching <path id="logoArc">.
  const P0 = { x: 163, y: 84 };
  const P1 = { x: 234, y: 50 };
  const P2 = { x: 305, y: 84 };

  function bezierPoint(t) {
    const mt = 1 - t;
    return {
      x: mt * mt * P0.x + 2 * mt * t * P1.x + t * t * P2.x,
      y: mt * mt * P0.y + 2 * mt * t * P1.y + t * t * P2.y
    };
  }
  function bezierTangent(t) {
    return {
      x: 2 * (1 - t) * (P1.x - P0.x) + 2 * t * (P2.x - P1.x),
      y: 2 * (1 - t) * (P1.y - P0.y) + 2 * t * (P2.y - P1.y)
    };
  }

  // Build an arc-length lookup table by sampling the curve.
  const STEPS = 300;
  const samples = [{ t: 0, s: 0, pt: bezierPoint(0) }];
  let cumulative = 0;
  for (let i = 1; i <= STEPS; i++) {
    const t = i / STEPS;
    const pt = bezierPoint(t);
    const prev = samples[i - 1].pt;
    cumulative += Math.hypot(pt.x - prev.x, pt.y - prev.y);
    samples.push({ t, s: cumulative, pt });
  }
  const totalLength = cumulative;

  function pointAtArcLength(s) {
    s = Math.max(0, Math.min(totalLength, s));
    let lo = 0, hi = samples.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (samples[mid].s < s) lo = mid; else hi = mid;
    }
    const a = samples[lo], b = samples[hi];
    const frac = b.s === a.s ? 0 : (s - a.s) / (b.s - a.s);
    const t = a.t + (b.t - a.t) * frac;
    return { pt: bezierPoint(t), tangent: bezierTangent(t) };
  }

  // Measure each character's natural width using a temporary, invisible
  // text element so metrics match this exact font stack precisely.
  const ns = 'http://www.w3.org/2000/svg';
  const measurer = document.createElementNS(ns, 'text');
  measurer.setAttribute('font-family', group.getAttribute('font-family'));
  measurer.setAttribute('font-size', baseFontSize);
  measurer.style.visibility = 'hidden';
  group.appendChild(measurer);

  const chars = text.split('');
  const widths = chars.map(ch => {
    measurer.textContent = ch;
    return measurer.getComputedTextLength();
  });
  group.removeChild(measurer);

  const naturalTotal = widths.reduce((a, b) => a + b, 0);
  const scale = naturalTotal > 0 ? targetWidth / naturalTotal : 1;
  const fontSize = baseFontSize * scale;
  const scaledWidths = widths.map(w => w * scale);

  const midS = totalLength / 2;
  let cursorS = midS - targetWidth / 2;

  chars.forEach((ch, i) => {
    const centerS = cursorS + scaledWidths[i] / 2;
    cursorS += scaledWidths[i];
    if (ch === ' ') return;

    const { pt, tangent } = pointAtArcLength(centerS);
    const angle = Math.atan2(tangent.y, tangent.x) * 180 / Math.PI;

    const glyph = document.createElementNS(ns, 'text');
    glyph.setAttribute('x', pt.x);
    glyph.setAttribute('y', pt.y);
    glyph.setAttribute('text-anchor', 'middle');
    glyph.setAttribute('font-size', fontSize);
    glyph.setAttribute('transform', `rotate(${angle} ${pt.x} ${pt.y})`);
    glyph.textContent = ch;
    group.appendChild(glyph);
  });
}

// ── String-set picker (fretboard) ────────────────────────────────────────────

// Builds the headstock logo, tuners, fretboard, and interactive string
// groups once into the caller's <svg id="board">. onSelect(stringSetKey)
// fires whenever the user clicks a string group; defaultGroup (an index into
// ['EAD','ADG','DGB','GBe']) is locked in immediately, so it should match
// whatever the caller's static #readoutValue markup already displays.
function buildStringSetPicker({ onSelect, defaultGroup = 3 } = {}) {
  renderHeadstockLogo();

  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.getElementById('board');

  const STRING_NAMES = ['E', 'A', 'D', 'G', 'B', 'e'];
  const STRING_SET_KEYS = ['EAD', 'ADG', 'DGB', 'GBe'];
  const n = STRING_NAMES.length;
  const BOARD_X0 = 181, BOARD_X1 = 287;
  const NUT_Y = 320, BOARD_BOTTOM = 520;
  const xs = STRING_NAMES.map((_, i) => BOARD_X0 + (BOARD_X1 - BOARD_X0) * (i / (n - 1)));
  const thickness = [3.2, 2.6, 2.1, 1.7, 1.3, 0.9];

  const HEAD_TOP_Y = 30, HEAD_TAPER_END_Y = 310;
  const EDGE_TOP_L = 151.2, EDGE_TOP_R = 316.8;
  const EDGE_BOTTOM_L = 158.4, EDGE_BOTTOM_R = 309.6;
  function edgeLeft(y) {
    const t = (y - HEAD_TOP_Y) / (HEAD_TAPER_END_Y - HEAD_TOP_Y);
    return EDGE_TOP_L + (EDGE_BOTTOM_L - EDGE_TOP_L) * t;
  }
  function edgeRight(y) {
    const t = (y - HEAD_TOP_Y) / (HEAD_TAPER_END_Y - HEAD_TOP_Y);
    return EDGE_TOP_R + (EDGE_BOTTOM_R - EDGE_TOP_R) * t;
  }

  const grain = document.getElementById('grain');
  for (let i = 0; i < 7; i++) {
    const x = 160 + i * 19.8 + (Math.random() * 4 - 2);
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', x); line.setAttribute('y1', 36);
    line.setAttribute('x2', x + (Math.random() * 7 - 3.5)); line.setAttribute('y2', 304);
    grain.appendChild(line);
  }

  const tunerGroup = document.getElementById('tuners');
  const ROW_Y = [95, 165, 235];
  const postPositions = {};

  function makeTuner(edgeX, y, side) {
    const g = document.createElementNS(NS, 'g');
    const postX = edgeX + side * -18;
    const btnX = edgeX + side * 12.6;

    const rod = document.createElementNS(NS, 'line');
    rod.setAttribute('x1', edgeX); rod.setAttribute('y1', y);
    rod.setAttribute('x2', btnX); rod.setAttribute('y2', y);
    rod.setAttribute('stroke', 'var(--fb-tuner-dark)');
    rod.setAttribute('stroke-width', 2.7);
    g.appendChild(rod);

    const btn = document.createElementNS(NS, 'ellipse');
    btn.setAttribute('cx', btnX);
    btn.setAttribute('cy', y);
    btn.setAttribute('rx', 14.5);
    btn.setAttribute('ry', 10.5);
    btn.setAttribute('fill', 'var(--fb-wood-btn)');
    btn.setAttribute('stroke', 'var(--fb-tuner-dark)');
    btn.setAttribute('stroke-width', 1);
    g.appendChild(btn);

    const post = document.createElementNS(NS, 'circle');
    post.setAttribute('cx', postX); post.setAttribute('cy', y);
    post.setAttribute('r', 5.4);
    post.setAttribute('fill', 'var(--fb-tuner)');
    post.setAttribute('stroke', 'var(--fb-tuner-dark)');
    post.setAttribute('stroke-width', 1.2);
    g.appendChild(post);

    const cap = document.createElementNS(NS, 'circle');
    cap.setAttribute('cx', postX); cap.setAttribute('cy', y);
    cap.setAttribute('r', 2.7);
    cap.setAttribute('fill', 'var(--fb-tuner-dark)');
    g.appendChild(cap);

    return { el: g, postX, y };
  }

  const leftOrder = [{ row: 0, str: 2 }, { row: 1, str: 1 }, { row: 2, str: 0 }];
  leftOrder.forEach(({ row, str }) => {
    const y = ROW_Y[row];
    const t = makeTuner(edgeLeft(y), y, -1);
    tunerGroup.appendChild(t.el);
    postPositions[str] = { x: t.postX, y: t.y };
  });

  const rightOrder = [{ row: 0, str: 3 }, { row: 1, str: 4 }, { row: 2, str: 5 }];
  rightOrder.forEach(({ row, str }) => {
    const y = ROW_Y[row];
    const t = makeTuner(edgeRight(y), y, 1);
    tunerGroup.appendChild(t.el);
    postPositions[str] = { x: t.postX, y: t.y };
  });

  const fanGroup = document.getElementById('fanStrings');
  STRING_NAMES.forEach((_, i) => {
    const p = postPositions[i];
    const nutX = xs[i];
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', p.x); line.setAttribute('y1', p.y);
    line.setAttribute('x2', nutX); line.setAttribute('y2', NUT_Y);
    line.setAttribute('stroke', '#cabfa9');
    line.setAttribute('stroke-width', thickness[i]);
    line.setAttribute('stroke-linecap', 'round');
    fanGroup.appendChild(line);
  });

  const fretsGroup = document.getElementById('frets');
  const FRETS = 2;
  const fretH = (BOARD_BOTTOM - NUT_Y) / FRETS;
  for (let i = 1; i <= FRETS; i++) {
    const y = NUT_Y + i * fretH;
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', 170.2); line.setAttribute('y1', y);
    line.setAttribute('x2', 297.8); line.setAttribute('y2', y);
    line.setAttribute('stroke', 'var(--fb-fret)');
    line.setAttribute('stroke-width', '4');
    fretsGroup.appendChild(line);
  }

  const stringsGroup = document.getElementById('strings');
  const stringEls = [];
  xs.forEach((x, i) => {
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', x);
    line.setAttribute('y1', NUT_Y);
    line.setAttribute('x2', x);
    line.setAttribute('y2', BOARD_BOTTOM);
    line.setAttribute('stroke', '#cabfa9');
    line.setAttribute('stroke-width', thickness[i]);
    line.setAttribute('stroke-linecap', 'round');
    stringsGroup.appendChild(line);
    stringEls.push(line);
  });

  const labelsGroup = document.getElementById('labels');
  const labelEls = [];
  xs.forEach((x, i) => {
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('x', x);
    t.setAttribute('y', BOARD_BOTTOM + 26);
    t.setAttribute('class', 'string-name');
    t.textContent = STRING_NAMES[i];
    labelsGroup.appendChild(t);
    labelEls.push(t);
  });

  const GROUPS = [[0, 1, 2], [1, 2, 3], [2, 3, 4], [3, 4, 5]];
  const centers = GROUPS.map(g => xs[g[1]]);

  const hoverBand = document.getElementById('hoverBand');
  const catcher = document.getElementById('catcher');
  const readout = document.getElementById('readoutValue');

  let lockedGroup = defaultGroup;

  function groupLabel(gi) {
    return GROUPS[gi].map(idx => STRING_NAMES[idx]).join(' ');
  }

  function nearestGroup(x) {
    let best = 0, bestD = Infinity;
    centers.forEach((c, i) => {
      const d = Math.abs(x - c);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  function paint(gi, isLock) {
    const idxs = GROUPS[gi];
    const leftX = xs[idxs[0]];
    const rightX = xs[idxs[idxs.length - 1]];
    const pad = 4;
    hoverBand.setAttribute('x', leftX - pad);
    hoverBand.setAttribute('y', NUT_Y - 4);
    hoverBand.setAttribute('width', (rightX - leftX) + pad * 2);
    hoverBand.setAttribute('height', (BOARD_BOTTOM - NUT_Y) + 8);
    hoverBand.setAttribute('opacity', isLock ? 0.24 : 0.12);

    stringEls.forEach((el, i) => {
      const active = idxs.includes(i);
      el.setAttribute('stroke', active ? 'var(--fb-accent)' : '#cabfa9');
      el.setAttribute('stroke-width', active ? thickness[i] + (isLock ? 1.6 : 1) : thickness[i]);
    });
    labelEls.forEach((el, i) => {
      el.setAttribute('class', idxs.includes(i) ? 'string-name hot' : 'string-name');
    });
  }

  function clearPaint() {
    hoverBand.setAttribute('opacity', 0);
    stringEls.forEach((el, i) => {
      el.setAttribute('stroke', '#cabfa9');
      el.setAttribute('stroke-width', thickness[i]);
    });
    labelEls.forEach(el => el.setAttribute('class', 'string-name'));
  }

  function localPoint(e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }

  catcher.addEventListener('mousemove', (e) => {
    const gi = nearestGroup(localPoint(e).x);
    paint(gi, lockedGroup === gi);
  });

  catcher.addEventListener('mouseleave', () => {
    if (lockedGroup === null) {
      clearPaint();
    } else {
      paint(lockedGroup, true);
    }
  });

  catcher.addEventListener('click', (e) => {
    const gi = nearestGroup(localPoint(e).x);
    lockedGroup = gi;
    paint(gi, true);
    readout.textContent = groupLabel(gi);
    readout.classList.remove('empty');
    onSelect && onSelect(STRING_SET_KEYS[gi]);
  });

  // Lock the default group in
  paint(defaultGroup, true);
}
