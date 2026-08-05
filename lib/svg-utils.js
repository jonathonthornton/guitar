// Shared SVG helpers used by the circle-of-fifths, fretboard, and stave
// renderers across chords.html, modes.html, and scales.html.

function getPosition(angle, radius) {
  const rad = (angle * Math.PI) / 180;
  return { x: 200 + radius * Math.cos(rad), y: 200 + radius * Math.sin(rad) };
}

function createArcPath(startAngle, endAngle, innerRadius, outerRadius) {
  const start1 = getPosition(startAngle, innerRadius);
  const end1 = getPosition(endAngle, innerRadius);
  const start2 = getPosition(startAngle, outerRadius);
  const end2 = getPosition(endAngle, outerRadius);
  return `M ${start2.x} ${start2.y} A ${outerRadius} ${outerRadius} 0 0 1 ${end2.x} ${end2.y} L ${end1.x} ${end1.y} A ${innerRadius} ${innerRadius} 0 0 0 ${start1.x} ${start1.y} Z`;
}

function createSVGElement(tag, attributes) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) el.setAttribute(key, value);
  return el;
}
