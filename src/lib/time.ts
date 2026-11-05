const WIB = 'Asia/Jakarta';

const wibFormat = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: WIB,
});

/** "5 November 2026, 18.30 WIB" */
export function formatWib(iso: string | null | undefined): string {
  if (!iso) return 'tidak tersedia';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'tidak tersedia';
  return `${wibFormat.format(d).replace(':', '.')} WIB`;
}

/** Indonesian relative time: "baru saja", "12 menit lalu", "3 jam lalu", "2 hari lalu". */
export function relativeId(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return 'tidak tersedia';
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 'tidak tersedia';
  const min = Math.floor((now - t) / 60000);
  if (min < 1) return 'baru saja';
  if (min < 60) return `${min} menit lalu`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} jam lalu`;
  return `${Math.floor(h / 24)} hari lalu`;
}
