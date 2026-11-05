import './site-header.css';

const NAV = [
  { id: 'pantau', label: 'Pantau', path: '' },
  { id: 'kisah', label: 'Kisah 20 tahun', path: 'kisah/' },
  { id: 'metode', label: 'Metode & sumber', path: 'metode/' },
] as const;

export interface SiteHeaderProps {
  current: (typeof NAV)[number]['id'];
}

export function SiteHeader({ current }: SiteHeaderProps) {
  const base = import.meta.env.BASE_URL;
  return (
    <header className="site-header">
      <a className="site-wordmark" href={base}>
        bara
      </a>
      <nav className="site-nav" aria-label="Navigasi utama">
        {NAV.map((item) => (
          <a
            key={item.id}
            href={`${base}${item.path}`}
            aria-current={current === item.id ? 'page' : undefined}
          >
            {item.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
