// Fret-region picker: a horizontal neck diagram divided into four clickable
// 4-fret regions (Open–3rd, 4th–7th, 8th–11th, 12th–15th), used by
// chords.html and triads.html. Depends on createSVGElement/injectStyleOnce
// from svg-utils.js.
//
// Like renderCircleOfFifths, this holds no selection state of its own —
// callers keep their own `let selectedRegion = REGIONS[0]` and call
// paintRegionPicker() after any change (their own click handler, wired via
// buildRegionPicker's onSelect, is the one place that both updates that
// state and re-runs whatever depends on it).
//
// This module owns its own markup and CSS: the caller just provides an empty
// mount element carrying class="region-picker" (default id "region-control"
// — chords.html already uses that id to show/hide this control when
// switching restrict-by mode), and buildRegionPicker() builds the neck-wrap/
// svg/readout skeleton into it, injecting this widget's stylesheet at the
// same time.

const REGIONS = [
  { lo: 0, hi: 3, label: 'Open – 3rd' },
  { lo: 4, hi: 7, label: '4th – 7th' },
  { lo: 8, hi: 11, label: '8th – 11th' },
  { lo: 12, hi: 15, label: '12th – 15th' }
];

const REGION_PICKER_CSS = `
.region-picker {
  display: flex;
  flex-direction: column;
}

.region-picker .neck-wrap {
  position: relative;
  width: 100%;
}

.region-picker svg {
  display: block;
  width: 100%;
  height: auto;
}

.region-segment {
  cursor: pointer;
}

.region-segment rect.region-fill {
  fill: transparent;
  stroke: transparent;
  transition: fill 0.15s ease, stroke 0.15s ease;
}

/* A translucent gold wash alone reads as muddy brown once it's blended
   with the dark navy neck behind it — a crisp gold border keeps the
   highlight unambiguously gold at a glance. */
.region-segment:hover rect.region-fill {
  fill: rgba(224, 169, 64, 0.22);
  stroke: #e0a940;
  stroke-width: 1.5;
}

.region-segment.selected rect.region-fill {
  fill: rgba(224, 169, 64, 0.38);
  stroke: #e0a940;
  stroke-width: 1.25;
}

.region-segment text {
  fill: var(--muted);
  font-family: 'DM Mono', monospace;
  font-size: 9px;
  text-anchor: middle;
  pointer-events: none;
  transition: fill 0.15s ease;
}

.region-segment.selected text {
  fill: var(--amber);
}

.region-picker .readout {
  margin-top: 8px;
  display: flex;
  align-items: baseline;
  justify-content: center;
  gap: 8px;
  min-height: 20px;
}

.region-picker .readout .value {
  font-family: 'DM Mono', monospace;
  font-size: 0.95rem;
  letter-spacing: 0.12em;
  color: var(--amber);
}
`;

const REGION_NECK_X0 = 20, REGION_NECK_X1 = 280, REGION_NUT_X = 20;
const REGION_NECK_Y0 = 23, REGION_NECK_Y1 = 57;
const REGION_TOTAL_FRETS = 15;

function regionFretX(i) {
  return REGION_NECK_X0 + (REGION_NECK_X1 - REGION_NECK_X0) * (i / REGION_TOTAL_FRETS);
}

let regionEls = [];

// Builds the neck-wrap/svg/readout skeleton into the caller's (empty)
// `containerId` element, then the fret ticks, position markers, and
// clickable region overlays inside that. onSelect(region, index) fires
// whenever the user clicks a region segment.
//
//   containerId — id of the mount element, already carrying
//     class="region-picker" (chords.html reuses its existing "region-control"
//     id, which it also uses to show/hide this control).
//   align — the picker's own cross-axis alignment (chords.html centers it
//     alongside its narrower neck diagram; triads.html left-aligns it to
//     match the Key/Staff controls beside it).
//   neckMaxWidth — CSS max-width in px for the neck diagram (chords.html
//     uses a narrower 300px to sit comfortably beside its other controls;
//     triads.html uses 340px, matching its stave's own width). Both are
//     applied as inline styles so they don't depend on cascade order against
//     this module's own injected stylesheet.
function buildRegionPicker({ containerId = 'region-control', align = 'flex-start', neckMaxWidth = 340, onSelect } = {}) {
  injectStyleOnce('region-picker-styles', REGION_PICKER_CSS);

  const container = document.getElementById(containerId);
  container.style.alignItems = align;
  container.innerHTML = `
    <div class="neck-wrap" style="max-width:${neckMaxWidth}px">
      <svg id="neck" viewBox="13 0 287 90" xmlns="http://www.w3.org/2000/svg">
        <rect x="20" y="23" width="260" height="34" fill="var(--surface)" stroke="var(--border)" stroke-width="1"/>
        <g id="fretTicks"></g>
        <g id="positionMarkers"></g>
        <rect x="15" y="18" width="5" height="44" fill="var(--cream)"/>
        <g id="regions"></g>
      </svg>
    </div>
    <div class="readout">
      <span class="value" id="regionReadout"></span>
    </div>
  `;

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
