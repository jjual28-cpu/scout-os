'use client';

import { X } from 'lucide-react';

import { DmStyleEditor } from './dm-style-editor';

/**
 * "내 DM 스타일" 편집기를 페이지 이동 없이 그 자리에서 팝업(모달)으로 연다.
 * 셀럽 상세·CRM 드로어·아웃리치 어디서든 재사용. (드로어 위에 뜨도록 z-50)
 */
export function DmStyleDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="bg-background relative z-10 max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-2xl border p-6 shadow-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold">내 DM 스타일</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>
        <DmStyleEditor />
      </div>
    </div>
  );
}
