import type { ReactNode } from 'react';

const ICONS: Record<string, ReactNode> = {
  star: <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z" />,
  sparkles: <><path d="M12 3v3M12 18v3M3 12h3M18 12h3" /><path d="M12 8l1.5 2.5L16 12l-2.5 1.5L12 16l-1.5-2.5L8 12l2.5-1.5z" /></>,
  compass: <><circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88" /></>,
  building: <><path d="M4 22V5a2 2 0 012-2h12a2 2 0 012 2v17" /><path d="M4 22h16" /><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" /></>,
  grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /></>,
  'check-double': <><polyline points="20 6 9 17 4 12" /><polyline points="14 6 11 9" /></>,
  calendar: <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></>,
  clock: <><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></>,
  home: <><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
  navigation: <polygon points="3 11 22 2 13 21 11 13 3 11" />,
  thermometer: <path d="M14 14.76V3.5a2.5 2.5 0 00-5 0v11.26a4.5 4.5 0 105 0z" />,
  bot: <><rect x="4" y="8" width="16" height="12" rx="2" /><path d="M2 14v4M22 14v4" /><circle cx="9" cy="14" r="1" /><circle cx="15" cy="14" r="1" /><path d="M12 4v4M9 4h6" /></>,
  'alert-triangle': <><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></>,
  gift: <><polyline points="20 12 20 22 4 22 4 12" /><rect x="2" y="7" width="20" height="5" /><line x1="12" y1="22" x2="12" y2="7" /><path d="M12 7H7.5a2.5 2.5 0 010-5C11 2 12 7 12 7z" /><path d="M12 7h4.5a2.5 2.5 0 000-5C13 2 12 7 12 7z" /></>,
  link: <><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71" /></>,
  zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  layers: <><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></>,
  'book-open': <><path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" /><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h6z" /></>,
  'shield-check': <><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" /></>,
  target: <><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></>,
  'trending-up': <><polyline points="23 6 13.5 15.5 8.5 10.5 1 18" /><polyline points="17 6 23 6 23 12" /></>,
  'list-checks': <><path d="M3 6l2 2 3-3" /><path d="M3 12l2 2 3-3" /><path d="M3 18l2 2 3-3" /><line x1="12" y1="6" x2="21" y2="6" /><line x1="12" y1="12" x2="21" y2="12" /><line x1="12" y1="18" x2="21" y2="18" /></>,
  'gallery-vertical': <><path d="M7 2h10M7 22h10" /><rect x="5" y="6" width="14" height="12" rx="1" /></>,
  'heart-handshake': <><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" /><path d="M7 11l2.5 2.5L14 9" /></>,
  cloud: <path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z" />,
  users: <><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></>,
  eye: <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>,
  book: <><path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" /></>,
  lightbulb: <><path d="M9 18h6M10 22h4" /><path d="M12 2a7 7 0 00-7 7c0 2.5 1.5 4.5 3 6l1 1h6l1-1c1.5-1.5 3-3.5 3-6a7 7 0 00-7-7z" /></>,
  heart: <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />,
  crown: <><path d="M3 6l4.5 4.5L12 4l4.5 6.5L21 6l-2 12H5L3 6z" /><line x1="5" y1="21" x2="19" y2="21" /></>,
  'pen-tool': <><path d="M12 19l7-7 3 3-7 7-3-3z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5z" /><path d="M2 2l7.586 7.586" /><circle cx="11" cy="11" r="2" /></>,
  user: <><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></>,
  'book-marked': <><path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" /><path d="M12 4v6l2-1.5L16 10V4" /></>,
  calculator: <><rect x="4" y="2" width="16" height="20" rx="2" /><line x1="8" y1="6" x2="16" y2="6" /><line x1="8" y1="10" x2="8.01" y2="10" /><line x1="12" y1="10" x2="12.01" y2="10" /><line x1="16" y1="10" x2="16.01" y2="10" /><line x1="8" y1="14" x2="8.01" y2="14" /><line x1="12" y1="14" x2="12.01" y2="14" /><line x1="16" y1="14" x2="16.01" y2="14" /><line x1="8" y1="18" x2="8.01" y2="18" /><line x1="12" y1="18" x2="12.01" y2="18" /><line x1="16" y1="18" x2="16.01" y2="18" /></>,
  'calendar-days': <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><line x1="8" y1="14" x2="8" y2="16" /><line x1="12" y1="14" x2="12" y2="16" /><line x1="16" y1="14" x2="16" y2="16" /><line x1="8" y1="18" x2="8" y2="20" /><line x1="12" y1="18" x2="12" y2="20" /><line x1="16" y1="18" x2="16" y2="20" /></>,
  'calendar-check': <><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /><polyline points="9 16 11 18 15 14" /></>,
  orbit: <><circle cx="12" cy="12" r="3" /><circle cx="19" cy="5" r="2" /><path d="M10.4 21.9a10 10 0 009.95-5.46M3.56 12A9.96 9.96 0 015.1 6.1m5.3-3.99a9.96 9.96 0 0111.2 5.7" /></>,
  history: <><path d="M3 3v5h5" /><path d="M3.05 13A9 9 0 106 5.3L3 8" /><polyline points="12 7 12 12 15 14" /></>,
  type: <><polyline points="4 7 4 4 20 4 20 7" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="4" x2="12" y2="20" /></>,
  'notebook-pen': <><path d="M3 4a2 2 0 012-2h12a2 2 0 012 2v16a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><path d="M8 6h6M8 10h6M8 14h4" /><path d="M18 2v20" /></>,
  footprint: <><path d="M4 16v-2.5C4 11 6 10 8 10s4 1 4 3.5V16a2 2 0 01-2 2H6a2 2 0 01-2-2z" /><path d="M14 9V7.5C14 5 16 4 18 4s4 1 4 3.5V9a2 2 0 01-2 2h-4a2 2 0 01-2-2z" /></>,
  flower: <><circle cx="12" cy="12" r="2" /><path d="M12 2c2 2.5 2 6 0 8-2-2-2-5.5 0-8z" /><path d="M22 12c-2.5 2-6 2-8 0 2-2 5.5-2 8 0z" /><path d="M12 22c-2-2.5-2-6 0-8 2 2 2 5.5 0 8z" /><path d="M2 12c2.5-2 6-2 8 0-2 2-5.5 2-8 0z" /></>,
  pentagon: <><polygon points="12 2 22 9.5 18.5 21 5.5 21 2 9.5" /></>,
  hexagram: <><line x1="4" y1="4" x2="20" y2="4" /><line x1="7" y1="8" x2="17" y2="8" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="7" y1="16" x2="17" y2="16" /><line x1="4" y1="20" x2="20" y2="20" /></>,
  'chart-bar': <><line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" /><line x1="3" y1="20" x2="21" y2="20" /></>,
};

export interface SectionIconProps {
  name: string;
  size?: number;
  className?: string;
}

export default function SectionIcon({ name, size = 18, className = 'title-icon' }: SectionIconProps) {
  const content = ICONS[name];
  if (!content) return null;
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {content}
    </svg>
  );
}
