'use client';
import { useRouter } from 'next/navigation';
import Card from './Card';
import Button from './Button';
import SectionTitle from './SectionTitle';
import type { ReactNode } from 'react';

export interface CrossPageLinkItem {
  icon: string;
  label: string;
  href: string;
  variant?: 'ghost' | 'primary';
}

export interface CrossPageLinkProps {
  links: CrossPageLinkItem[];
  title?: string;
  description?: ReactNode;
}

export default function CrossPageLink({ links, title = '跨页联动', description }: CrossPageLinkProps) {
  const router = useRouter();
  return (
    <Card variant="side" className="cross-page-card">
      <SectionTitle icon="link">{title}</SectionTitle>
      {description && <p className="cross-page-desc">{description}</p>}
      <div className="cross-page-list">
        {links.map((link, i) => (
          <Button
            key={i}
            variant={link.variant || 'ghost'}
            onClick={() => router.push(link.href)}
          >
            {link.icon} {link.label}
          </Button>
        ))}
      </div>
    </Card>
  );
}
