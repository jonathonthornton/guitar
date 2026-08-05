// Shared circle-of-fifths key selector, used by chords.html, modes.html, and
// scales.html. Depends on getPosition/createArcPath/createSVGElement from
// svg-utils.js, so load this file after svg-utils.js.
//
// renderCircleOfFifths() is a pure render function: it holds no state of its
// own. Callers pass in the currently selected key/quality and get click and
// (optional) hover callbacks back, then own re-rendering after any selection
// change.

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

// Renders the wheel into the <svg id="svgId"> element.
//
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
  svgId = 'circle-of-fifths',
  selectedKey,
  selectedKeyType = 'major',
  minorRing = true,
  fontFamily = 'DM Mono, monospace',
  centerLines = ['Circle', 'of Fifths'],
  onSelect,
  onHover,
  onHoverEnd,
} = {}) {
  const svg = document.getElementById(svgId);
  svg.innerHTML = '';

  svg.appendChild(createSVGElement('circle', { cx: 200, cy: 200, r: 190, fill: '#1a1814', stroke: '#2e2b25', 'stroke-width': 2 }));

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
      fill: isSelected ? '#c9a84c' : '#221f19',
      stroke: '#2e2b25',
      'stroke-width': 1.5,
      class: `circle-segment major ${isSelected ? 'selected' : ''}`
    });

    const text = createSVGElement('text', {
      x: pos.x, y: pos.y,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      fill: isSelected ? '#0f0e0c' : '#e8e0d0',
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
        fill: isSelected ? '#0f0e0c' : '#7a7060',
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
        fill: isSelected ? '#8b5e3c' : '#1a1814',
        stroke: '#2e2b25',
        'stroke-width': 1,
        class: `circle-segment minor ${isSelected ? 'selected' : ''}`
      });

      const text = createSVGElement('text', {
        x: pos.x, y: pos.y,
        'text-anchor': 'middle',
        'dominant-baseline': 'middle',
        fill: isSelected ? '#e8e0d0' : '#9a8f78',
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
          fill: isSelected ? '#d8c8b0' : '#7a7060',
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

  svg.appendChild(createSVGElement('circle', { cx: 200, cy: 200, r: 55, fill: '#0f0e0c', stroke: '#2e2b25', 'stroke-width': 2 }));
  const ct1 = createSVGElement('text', { x: 200, y: 192, 'text-anchor': 'middle', fill: '#7a7060', 'font-size': 12, 'font-family': 'DM Mono, monospace' });
  ct1.textContent = centerLines[0];
  svg.appendChild(ct1);
  const ct2 = createSVGElement('text', { x: 200, y: 210, 'text-anchor': 'middle', fill: '#7a7060', 'font-size': 12, 'font-family': 'DM Mono, monospace' });
  ct2.textContent = centerLines[1];
  svg.appendChild(ct2);
}
