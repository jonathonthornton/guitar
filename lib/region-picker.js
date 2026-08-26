// Fret-region picker: a horizontal neck diagram divided into four clickable
// 4-fret regions (Open–3rd, 4th–7th, 8th–11th, 12th–15th), shared by
// triad-position.html and triads.html. Depends on
// createSVGElement from svg-utils.js.
//
// Like renderCircleOfFifths, this holds no selection state of its own —
// callers keep their own `let selectedRegion = REGIONS[0]` and call
// paintRegionPicker() after any change (their own click handler, wired via
// buildRegionPicker's onSelect, is the one place that both updates that
// state and re-runs whatever depends on it).
//
// Expects the caller's HTML to provide:
//   <svg id="neck" viewBox="0 0 300 90">
//     <rect .../>                  neck base, drawn statically by the caller
//     <g id="fretTicks"></g>
//     <g id="positionMarkers"></g>
//     <rect .../>                  nut, drawn statically by the caller
//     <g id="regions"></g>
//   </svg>
//   <span id="regionReadout">...</span>
// — see triad-position.html for the exact static markup (neck-base/nut
// rects, dimensions, styling) this geometry is built to match.

const REGIONS = [
  { lo: 0, hi: 3, label: 'Open – 3rd' },
  { lo: 4, hi: 7, label: '4th – 7th' },
  { lo: 8, hi: 11, label: '8th – 11th' },
  { lo: 12, hi: 15, label: '12th – 15th' }
];

const REGION_NECK_X0 = 20, REGION_NECK_X1 = 280, REGION_NUT_X = 20;
const REGION_NECK_Y0 = 23, REGION_NECK_Y1 = 57;
const REGION_TOTAL_FRETS = 15;

function regionFretX(i) {
  return REGION_NECK_X0 + (REGION_NECK_X1 - REGION_NECK_X0) * (i / REGION_TOTAL_FRETS);
}

let regionEls = [];

// Builds the fret ticks, position markers, and clickable region overlays
// once into the caller's <svg id="neck">. onSelect(region, index) fires
// whenever the user clicks a region segment.
function buildRegionPicker({ onSelect } = {}) {
  // Fret tick lines
  const ticksGroup = document.getElementById('fretTicks');
  for (let i = 1; i <= REGION_TOTAL_FRETS; i++) {
    const x = regionFretX(i);
    ticksGroup.appendChild(createSVGElement('line', {
      x1: x, y1: REGION_NECK_Y0, x2: x, y2: REGION_NECK_Y1,
      stroke: 'var(--border)',
      'stroke-width': i === REGION_TOTAL_FRETS ? 1.5 : 1
    }));
  }

  // Position markers (single dot: frets 3, 5, 7, 9, 15 — double: fret 12)
  const markerGroup = document.getElementById('positionMarkers');
  function cellCenter(i) {
    return (regionFretX(i - 1) + regionFretX(i)) / 2;
  }
  function addDot(cx, cy) {
    markerGroup.appendChild(createSVGElement('circle', {
      cx, cy, r: 2.4, fill: 'var(--muted)', opacity: 0.5
    }));
  }
  [3, 5, 7, 9, 15].forEach(i => addDot(cellCenter(i), (REGION_NECK_Y0 + REGION_NECK_Y1) / 2));
  [12].forEach(i => {
    const cx = cellCenter(i);
    addDot(cx, REGION_NECK_Y0 + 7);
    addDot(cx, REGION_NECK_Y1 - 7);
  });

  // Region overlays (clickable) + labels
  const regionsGroup = document.getElementById('regions');
  regionEls = [];

  REGIONS.forEach((region, i) => {
    // Visual span: from the start of the lowest fret's cell (or the nut
    // for the open region) through the end of the highest fret's cell.
    const startX = region.lo === 0 ? REGION_NUT_X : regionFretX(region.lo - 1);
    const endX = regionFretX(region.hi);

    const g = createSVGElement('g', { class: 'region-segment' });
    g.appendChild(createSVGElement('rect', {
      class: 'region-fill', x: startX, y: REGION_NECK_Y0,
      width: endX - startX, height: REGION_NECK_Y1 - REGION_NECK_Y0
    }));

    const label = createSVGElement('text', { x: (startX + endX) / 2, y: REGION_NECK_Y1 + 14 });
    label.textContent = region.label;
    g.appendChild(label);

    g.addEventListener('click', () => onSelect && onSelect(region, i));
    regionsGroup.appendChild(g);
    regionEls.push(g);
  });
}

// Marks `selectedRegion` selected (toggling .selected on the right overlay)
// and updates the readout span. Call once after buildRegionPicker() to set
// the initial state, then again from the caller's own onSelect handler.
function paintRegionPicker(selectedRegion) {
  regionEls.forEach((g, i) => {
    g.classList.toggle('selected', REGIONS[i] === selectedRegion);
  });
  const readout = document.getElementById('regionReadout');
  if (readout) readout.textContent = selectedRegion.label + ' fret';
}
