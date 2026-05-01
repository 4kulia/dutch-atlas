import type { Category } from '../types';

const CATEGORY_COLOR: Record<Category, string> = {
  city_large: '#e11d48',
  city_historic: '#f59e0b',
  village: '#84cc16',
  hydraulic: '#0ea5e9',
  wind: '#06b6d4',
  nature: '#10b981',
  castle: '#a855f7',
  caribbean: '#ec4899',
  other: '#64748b',
};

interface Props {
  category: Category;
  selected?: boolean;
  size?: number;
}

export function MarkerIcon({ category, selected = false, size = 36 }: Props) {
  const color = CATEGORY_COLOR[category];
  const scale = selected ? 1.18 : 1;
  return (
    <div
      style={{
        width: size,
        height: size * 1.25,
        transform: `scale(${scale})`,
        transformOrigin: 'bottom center',
        transition: 'transform 160ms cubic-bezier(0.34, 1.56, 0.64, 1)',
        filter: selected ? `drop-shadow(0 4px 10px ${color}aa)` : 'drop-shadow(0 2px 4px rgba(0,0,0,0.5))',
        pointerEvents: 'auto',
      }}
    >
      <svg
        viewBox="0 0 24 30"
        width={size}
        height={size * 1.25}
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          d="M12 0c6.627 0 12 5.205 12 11.625C24 20.55 12 30 12 30S0 20.55 0 11.625C0 5.205 5.373 0 12 0z"
          fill={color}
        />
        <circle cx="12" cy="11.5" r="4.6" fill="#0b0f17" />
        <circle cx="12" cy="11.5" r="2.2" fill={color} opacity="0.95" />
      </svg>
    </div>
  );
}

export function CategoryDot({ category, size = 10 }: { category: Category; size?: number }) {
  return (
    <span
      aria-hidden
      className="inline-block rounded-full"
      style={{ width: size, height: size, background: CATEGORY_COLOR[category] }}
    />
  );
}

export { CATEGORY_COLOR };
