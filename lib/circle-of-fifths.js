// Shared circle-of-fifths key selector, used by chords.html, modes.html,
// scales.html, and triads.html. Depends on getPosition/createArcPath/
// createSVGElement/injectStyleOnce from svg-utils.js, so load this file
// after svg-utils.js.
//
// This module owns its own markup and CSS: the caller just provides an empty
// mount element (default id "circle-of-fifths-mount"), and
// renderCircleOfFifths() creates the <svg id="circle-of-fifths"> inside it
// the first time it's called, injecting this widget's stylesheet at the same
// time. Every call after that just clears and rebuilds the svg's own
// children — renderCircleOfFifths() otherwise holds no state of its own.
// Callers pass in the currently selected key/quality and get click and
// (optional) hover callbacks back, then own re-rendering after any selection
// change.

const CIRCLE_OF_FIFTHS_CSS = `
#circle-of-fifths {
  width: 100%;
  max-width: 340px;
  height: auto;
}

.circle-segment {
  cursor: pointer;
  transition: fill 0.15s ease;
}

.circle-text {
  pointer-events: none;
  -webkit-user-select: none;
  user-select: none;
}

/* Two-ring hover/selected states, for pages with both a major and a minor
   ring (chords.html, scales.html, triads.html). modes.html's single-ring
   wheel uses its own plain .circle-segment:hover/.selected instead (no
   .major/.minor qualifier) — every wedge still carries the major/minor class
   regardless of ring count, so that page-local override just happens to set
   the same values as these already do. */
.circle-segment.major:hover { fill: var(--amber-dim); }
.circle-segment.minor:hover { fill: var(--amber-dim); }
.circle-segment.major.selected { fill: var(--amber); }
.circle-segment.minor.selected { fill: #c99a3a; }
`;

const MAJOR_KEYS = [
  { name: 'C', angle: -90 },
  { name: 'G', angle: -60 },
  { name: 'D', angle: -30 },
  { name: 'A', angle: 0 },
  { name: 'E', angle: 30 },
  { name: 'B', angle: 60 },
  { name: 'F#', display: 'F♯', altDisplay: 'G♭', angle: 90 },
  { name: 'C#', display: 'D♭', altDisplay: '', angle: 120 },
  { name: 'G#', display: 'A♭', altDisplay: '', angle: 150 },
  { name: 'D#', display: 'E♭', altDisplay: '', angle: 180 },
  { name: 'A#', display: 'B♭', altDisplay: '', angle: 210 },
  { name: 'F', angle: 240 },
];

const MINOR_KEYS = [
  { name: 'A', display: 'Am', angle: -90 },
  { name: 'E', display: 'Em', angle: -60 },
  { name: 'B', display: 'Bm', angle: -30 },
  { name: 'F#', display: 'F♯m', angle: 0 },
  { name: 'C#', display: 'C♯m', angle: 30 },
  { name: 'G#', display: 'G♯m', altDisplay: 'A♭m', angle: 60 },
  { name: 'D#', display: 'D♯m', altDisplay: 'E♭m', angle: 90 },
  { name: 'A#', display: 'B♭m', angle: 120 },
  { name: 'F', display: 'Fm', angle: 150 },
  { name: 'C', display: 'Cm', angle: 180 },
  { name: 'G', display: 'Gm', angle: 210 },
  { name: 'D', display: 'Dm', angle: 240 },
];

// Renders the wheel, creating its own <svg id="svgId"> inside `containerId`
// the first time it's called for that container.
//
//   containerId — id of the (initially empty) element to build the <svg>
//     into. Only read the first time this svgId is seen; later calls reuse
//     the same svg and just rebuild its children.
//   maxWidth — CSS max-width in px for the svg (pages disagree: 340 on
//     modes.html/scales.html, 280 on chords.html/triads.html). Applied as an
//     inline style so per-page sizing doesn't depend on CSS cascade order
//     against this module's own injected stylesheet.
//   selectedKey, selectedKeyType — the currently selected key/quality, so the
//     matching wedge can be highlighted. selectedKeyType is ignored when
//     minorRing is false.
//   minorRing — true for a two-ring wheel (major outer, minor inner); false
//     for a single major-only ring (modes.html, which is always built on a
//     major parent key), which expands the major ring to fill the hub gap.
//   fontFamily — font used for the wedge labels (pages disagree: DM Mono on
//     chords.html, DM Sans on modes.html/scales.html).
//   centerLines — the two lines of text in the hub, e.g. ['Circle', 'of Fifths'].
//   onSelect(name, type) — called when a wedge is clicked.
//   onHover(name, type) / onHoverEnd() — optional hover-preview callbacks.
function renderCircleOfFifths({
  containerId = 'circle-of-fifths-mount',
  svgId = 'circle-of-fifths',
  maxWidth = 340,
  selectedKey,
  selectedKeyType = 'major',
  minorRing = true,
  fontFamily = 'DM Mono, monospace',
  centerLines = ['Circle', 'of Fifths'],
  onSelect,
  onHover,
  onHoverEnd,
} = {}) {
  injectStyleOnce('circle-of-fifths-styles', CIRCLE_OF_FIFTHS_CSS);

  let svg = document.getElementById(svgId);
  if (!svg) {
    svg = createSVGElement('svg', { id: svgId, viewBox: '0 0 400 400' });
    document.getElementById(containerId).appendChild(svg);
  }
  svg.style.maxWidth = `${maxWidth}px`;
  svg.innerHTML = '';

  svg.appendChild(createSVGElement('circle', { cx: 200, cy: 200, r: 190, fill: '#101623', stroke: '#2c3a5e', 'stroke-width': 2 }));

  // With no minor ring, the major ring expands inward to fill the space that
  // would otherwise belong to it, so its labels move outward and grow.
  const majorInner = minorRing ? 115 : 55;
  const labelRadius = minorRing ? 155 : 130;
  const labelFontSize = minorRing ? 18 : 20;
  const altFontSize = minorRing ? 11 : 12;
  const altOffset = minorRing ? 16 : 18;

  MAJOR_KEYS.forEach(key => {
    const startAngle = key.angle - 15;
    const endAngle = key.angle + 15;
    const pos = getPosition(key.angle, labelRadius);
    const isSelected = selectedKey === key.name && selectedKeyType === 'major';

    const g = createSVGElement('g', {});
    g.style.cursor = 'pointer';

    const path = createSVGElement('path', {
      d: createArcPath(startAngle, endAngle, majorInner, 190),
      fill: isSelected ? '#e0a940' : '#1b2540',
      stroke: '#2c3a5e',
      'stroke-width': 1.5,
      class: `circle-segment major ${isSelected ? 'selected' : ''}`
    });

    const text = createSVGElement('text', {
      x: pos.x, y: pos.y,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      fill: isSelected ? '#0a0e1a' : '#e8edf7',
      'font-size': labelFontSize,
      'font-weight': 'bold',
      'font-family': fontFamily,
      class: 'circle-text'
    });
    text.textContent = key.display || key.name;

    g.appendChild(path);
    g.appendChild(text);

    if (key.altDisplay) {
      const altText = createSVGElement('text', {
        x: pos.x, y: pos.y + altOffset,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        fill: isSelected ? '#0a0e1a' : '#7488ac',
        'font-size': altFontSize,
        'font-family': fontFamily,
        class: 'circle-text'
      });
      altText.textContent = key.altDisplay;
      g.appendChild(altText);
    }

    g.addEventListener('click', () => onSelect && onSelect(key.name, 'major'));
    if (onHover) g.addEventListener('mouseenter', () => onHover(key.name, 'major'));
    if (onHoverEnd) g.addEventListener('mouseleave', onHoverEnd);
    svg.appendChild(g);
  });

  if (minorRing) {
    MINOR_KEYS.forEach(key => {
      const startAngle = key.angle - 15;
      const endAngle = key.angle + 15;
      const pos = getPosition(key.angle, 85);
      const isSelected = selectedKey === key.name && selectedKeyType === 'minor';

      const g = createSVGElement('g', {});
      g.style.cursor = 'pointer';

      const path = createSVGElement('path', {
        d: createArcPath(startAngle, endAngle, 55, 115),
        fill: isSelected ? '#c99a3a' : '#101623',
        stroke: '#2c3a5e',
        'stroke-width': 1,
        class: `circle-segment minor ${isSelected ? 'selected' : ''}`
      });

      const text = createSVGElement('text', {
        x: pos.x, y: pos.y,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        fill: isSelected ? '#e8edf7' : '#8a9ac0',
        'font-size': 12,
        'font-weight': 500,
        'font-family': fontFamily,
        class: 'circle-text'
      });
      text.textContent = key.display || key.name;

      g.appendChild(path);
      g.appendChild(text);

      if (key.altDisplay) {
        const altText = createSVGElement('text', {
          x: pos.x, y: pos.y + 11,
          'text-anchor': 'middle',
          'dominant-baseline': 'middle',
          fill: isSelected ? '#f2ddc8' : '#7488ac',
          'font-size': 9,
          'font-family': fontFamily,
          class: 'circle-text'
        });
        altText.textContent = key.altDisplay;
        g.appendChild(altText);
      }

      g.addEventListener('click', () => onSelect && onSelect(key.name, 'minor'));
      if (onHover) g.addEventListener('mouseenter', () => onHover(key.name, 'minor'));
      if (onHoverEnd) g.addEventListener('mouseleave', onHoverEnd);
      svg.appendChild(g);
    });
  }

  svg.appendChild(createSVGElement('circle', { cx: 200, cy: 200, r: 55, fill: '#0a0e1a', stroke: '#2c3a5e', 'stroke-width': 2 }));
  const ct1 = createSVGElement('text', { x: 200, y: 192, 'text-anchor': 'middle', fill: '#7488ac', 'font-size': 12, 'font-family': 'DM Mono, monospace' });
  ct1.textContent = centerLines[0];
  svg.appendChild(ct1);
  const ct2 = createSVGElement('text', { x: 200, y: 210, 'text-anchor': 'middle', fill: '#7488ac', 'font-size': 12, 'font-family': 'DM Mono, monospace' });
  ct2.textContent = centerLines[1];
  svg.appendChild(ct2);
}
