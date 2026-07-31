'use client';

import { useEffect, useRef } from 'react';

import { useInboxReplyMap, replyKey } from '../hooks/use-inbox-reply-map';
import { useOutreach } from '../hooks/use-outreach';

/**
 * 인박스로 들어온 셀럽 답장을 연락기록(CRM)에 자동 반영하는 백그라운드 위젯(렌더 없음).
 * AppShell 에 한 번만 마운트 — 셀럽이 답장하면 어느 화면에 있든 CRM '답변' 컬럼·대시보드
 * '답변 대기'·리포트 응답률이 자동으로 갱신된다.
 *
 * 안전장치:
 *  - 이미 연락한(레코드 존재) 셀럽만 반영 → 유령 카드 안 생김
 *  - store 쪽에서 '답변옴'이면 no-op, 협업/제외 확정건은 status 유지(idempotent)
 *  - (creatorId, at) 조합을 세션 내 1회만 처리해 재렌더 루프 방지
 */
export function ReplyReconciler() {
  const { map, hydrated: inboxHydrated } = useInboxReplyMap();
  const { records, hydrated: outreachHydrated, markRepliedFromInbox } = useOutreach();
  const done = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!inboxHydrated || !outreachHydrated || map.size === 0) return;
    // 실제 레코드 키를 소문자로 색인 → 인박스 username 대소문자 차이를 흡수.
    const byKey = new Map<string, string>();
    for (const id of Object.keys(records)) byKey.set(replyKey(id), id);

    for (const [key, reply] of map) {
      const actualId = byKey.get(key);
      if (!actualId) continue; // 아직 연락한 적 없는 셀럽 → 인박스 페이지에서만 노출
      const guard = `${actualId}@${reply.at}`;
      if (done.current.has(guard)) continue;
      done.current.add(guard);
      markRepliedFromInbox(actualId, reply.text);
    }
  }, [map, records, inboxHydrated, outreachHydrated, markRepliedFromInbox]);

  return null;
}
