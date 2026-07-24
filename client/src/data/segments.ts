import { A } from '@/assets';
import type { SegmentDef } from '@/types';

export const SEGMENTS: SegmentDef[] = [
  {
    id: 'students',
    name: 'Students',
    description: 'Budget-friendly note-takers. Volume buyers; sensitive to price.',
    baseDemand: 18,
    priceSensitivity: 1.6,
    preferredPriceRef: 6,
    preference: { paperQuality: 0.4, coverPremium: 0.2, decorative: 0.5, functional: 0.7, packaging: 0.2 },
    imgPath: A.ui.segment.students,
  },
  {
    id: 'creators',
    name: 'Creators',
    description: 'Journal-lovers and artists. Want premium feel and decoration.',
    baseDemand: 10,
    priceSensitivity: 0.9,
    preferredPriceRef: 14,
    preference: { paperQuality: 0.9, coverPremium: 0.7, decorative: 0.9, functional: 0.4, packaging: 0.5 },
    imgPath: A.ui.segment.creators,
  },
  {
    id: 'professionals',
    name: 'Professionals',
    description: 'Minimalist + functional. Higher price tolerance, lower volume.',
    baseDemand: 8,
    priceSensitivity: 0.6,
    preferredPriceRef: 18,
    preference: { paperQuality: 0.85, coverPremium: 0.85, decorative: 0.15, functional: 0.95, packaging: 0.4 },
    imgPath: A.ui.segment.professionals,
  },
  {
    id: 'gift',
    name: 'Gift Buyers',
    description: 'Bursty demand around occasions. Care about decoration and packaging.',
    baseDemand: 6,
    priceSensitivity: 1.0,
    preferredPriceRef: 16,
    preference: { paperQuality: 0.5, coverPremium: 0.7, decorative: 0.95, functional: 0.3, packaging: 0.95 },
    imgPath: A.ui.segment.gift,
  },
];

export const segmentById = (id: string) => SEGMENTS.find((s) => s.id === id)!;
