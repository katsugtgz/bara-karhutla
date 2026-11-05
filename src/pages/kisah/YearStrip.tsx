import { formatId } from '../../lib/sky';

export interface StripYear {
  year: number;
  count: number;
}

/**
 * Compact bar strip of all 20 years (bars in --tea, active year in --ember).
 * Accessible: role="img" with a spoken summary, plus a visually-hidden data
 * table with every year and count.
 */
export function YearStrip({ years }: { years: StripYear[] }) {
  if (years.length === 0) return null;
  const max = Math.max(...years.map((y) => y.count), 1);
  const top = years.reduce((a, b) => (b.count > a.count ? b : a), years[0]!);
  return (
    <div className="kisah-strip">
      <svg
        viewBox={`0 0 ${years.length * 11 + 2} 66`}
        role="img"
        aria-label={`Jumlah titik panas MODIS per tahun ${years[0]?.year}–${years[years.length - 1]?.year}. Tertinggi ${top.year}: ${formatId(top.count)} titik panas.`}
      >
        {years.map((y, i) => {
          const h = 4 + 56 * (y.count / max);
          return (
            <rect
              key={y.year}
              className="kisah-bar"
              data-year={y.year}
              x={2 + i * 11}
              y={62 - h}
              width="8"
              height={h}
            />
          );
        })}
      </svg>
      {/* Hidden via a wrapper: tables ignore the 1px width and would widen the page. */}
      <div className="visually-hidden">
        <table>
          <caption>Jumlah titik panas MODIS per tahun, kepercayaan 30 ke atas</caption>
          <thead>
            <tr>
              <th scope="col">Tahun</th>
              <th scope="col">Titik panas</th>
            </tr>
          </thead>
          <tbody>
            {years.map((y) => (
              <tr key={y.year}>
                <th scope="row">{y.year}</th>
                <td className="num">{formatId(y.count)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
