'use client';

import { CreatorDetail } from '@/features/search';

/**
 * Real Instagram creator detail — the hub for the 발굴 → 확인 → 연락 → 후속관리 flow.
 * `creatorId` is the discovered_creators.external_id (e.g. "instagram:username").
 */
export default function CreatorDetailPage({ params }: { params: { creatorId: string } }) {
  return <CreatorDetail id={decodeURIComponent(params.creatorId)} />;
}
