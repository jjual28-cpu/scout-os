'use client';

import { cn } from '@/lib/utils';

import { LABEL_META, LABEL_ORDER } from '../label';
import { type CampaignLabel } from '../types';

/** A compact picker for a campaign's workflow Label (🟢🟡🔵🔴). */
export function CampaignLabelSelect({
  value,
  onChange,
  className,
}: {
  value: CampaignLabel;
  onChange: (label: CampaignLabel) => void;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as CampaignLabel)}
      onClick={(e) => e.stopPropagation()}
      className={cn(
        'border-input bg-background focus-visible:ring-ring rounded-lg border px-2.5 py-1.5 text-sm outline-none focus-visible:ring-2',
        className,
      )}
      aria-label="캠페인 상태"
    >
      {LABEL_ORDER.map((l) => (
        <option key={l} value={l}>
          {LABEL_META[l].emoji} {LABEL_META[l].label}
        </option>
      ))}
    </select>
  );
}
