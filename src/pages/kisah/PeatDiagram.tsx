/**
 * Peat cross-section: peat layer, water table, embers. As the section scrolls
 * through the viewport, the water table drops and the embers glow (CSS
 * scroll-driven animation, no JS). Without support — or with reduced motion —
 * the static drawn state already shows the drained, glowing peat.
 */
export function PeatDiagram() {
  return (
    <figure className="peat-fig">
      <svg
        viewBox="0 0 320 210"
        role="img"
        aria-label="Penampang gambut: muka air turun, gambut di atasnya mengering, dan bara tetap menyala di bawah permukaan."
      >
        {/* sky */}
        <rect x="0" y="0" width="320" height="70" className="peat-sky" />
        {/* peat body + surface */}
        <rect x="0" y="70" width="320" height="140" className="peat-body" />
        <line x1="0" y1="70" x2="320" y2="70" className="peat-surface" />
        {/* embers underground, in the zone that dries out */}
        <g className="peat-embers">
          <circle cx="96" cy="106" r="26" className="peat-glow" />
          <circle cx="96" cy="106" r="5" />
          <circle cx="168" cy="120" r="4" />
          <circle cx="212" cy="100" r="4.5" />
          <circle cx="248" cy="122" r="3.5" />
          <circle cx="140" cy="130" r="3" />
        </g>
        {/* water table: whole peat wet at first; drains down on scroll.
            The label travels with the water group. */}
        <g className="peat-water">
          <rect x="0" y="80" width="320" height="180" />
          <text x="12" y="94" className="peat-label peat-label-water">
            muka air
          </text>
        </g>
        {/* labels */}
        <text x="12" y="30" className="peat-label">
          udara
        </text>
        <text x="236" y="176" className="peat-label peat-label-peat">
          gambut
        </text>
        <text x="262" y="104" className="peat-label peat-label-ember">
          bara
        </text>
      </svg>
      <figcaption>
        Gambut yang dikeringkan mengering seperti spons. Bara bisa menyala di bawah tanah, lalu
        muncul kembali di tempat lain — hujan tidak memadamkannya.
      </figcaption>
    </figure>
  );
}
