'use client';

import { Check, Loader2, MessageSquareText, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { DEFAULT_DM_TEMPLATE, previewTemplate } from '../dm-template';
import { useDmTemplate } from '../hooks/use-dm-template';

/** 미리보기에 쓰는 예시 값. */
const SAMPLE_VARS = { 셀럽: '시세', 상품: '바노티 메이크업박스', 브랜드: 'FANDEAL' };

/**
 * "나만의 DM 스타일" 편집기. 고정 문구 + 변수({셀럽}/{상품}/{브랜드}) +
 * AI 구간([[ai: 지시]])을 담은 템플릿을 한 번 저장해두면, 셀럽마다 DM을 만들 때
 * AI 구간만 개인화되어 채워진다. 설정 페이지에 얹는다.
 */
export function DmStyleEditor() {
  const { template, hydrated, save } = useDmTemplate();
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (hydrated) setValue(template);
  }, [hydrated, template]);

  const insert = (token: string) => {
    const el = ref.current;
    if (!el) {
      setValue((v) => v + token);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    setValue(next);
    // 커서를 삽입한 토큰 뒤로.
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const onSave = async () => {
    setSaving(true);
    setError(null);
    const ok = await save(value);
    setSaving(false);
    if (ok) {
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2000);
    } else {
      setError('저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2">
        <MessageSquareText className="text-primary mt-0.5 size-4 shrink-0" />
        <p className="text-muted-foreground text-xs leading-relaxed">
          내 브랜드 스타일의 DM 틀을 저장하면, 셀럽마다 DM을 만들 때{' '}
          <span className="text-foreground font-medium">AI 구간만</span> 그 셀럽에 맞게 채워집니다.
          <br />
          변수 <code className="bg-muted rounded px-1">{'{셀럽}'}</code>{' '}
          <code className="bg-muted rounded px-1">{'{상품}'}</code>{' '}
          <code className="bg-muted rounded px-1">{'{브랜드}'}</code> 는 자동 치환, AI 구간은{' '}
          <code className="bg-muted rounded px-1">{'[[ai: 지시]]'}</code> 로 씁니다.
        </p>
      </div>

      {/* 토큰 삽입 버튼 */}
      <div className="flex flex-wrap gap-1.5">
        {(['{셀럽}', '{상품}', '{브랜드}'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => insert(t)}
            className="border-input bg-background hover:bg-muted rounded-full border px-2.5 py-1 font-mono text-xs transition-colors"
          >
            {t}
          </button>
        ))}
        <button
          type="button"
          onClick={() => insert('[[ai: 여기에 AI 지시를 쓰세요]]')}
          className="border-primary/40 bg-primary/10 text-primary hover:bg-primary/15 inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors"
        >
          <Sparkles className="size-3" />
          AI 구간
        </button>
        <button
          type="button"
          onClick={() => setValue(DEFAULT_DM_TEMPLATE)}
          className="text-muted-foreground hover:text-foreground ml-auto text-xs underline underline-offset-2"
        >
          기본 예시 넣기
        </button>
      </div>

      <textarea
        ref={ref}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={14}
        placeholder="‘기본 예시 넣기’를 눌러 시작하거나 직접 작성하세요."
        className="border-input bg-background focus-visible:ring-ring w-full resize-y rounded-lg border px-3 py-2 font-mono text-sm leading-relaxed outline-none focus-visible:ring-2"
      />

      {/* 미리보기 (예시 값 + AI 구간 자리표시) */}
      {value.trim() ? (
        <div className="dark:border-border rounded-lg border border-slate-200/60 p-3">
          <p className="text-muted-foreground mb-1.5 text-[11px] font-medium">
            미리보기 (예: {SAMPLE_VARS.셀럽}님 · {SAMPLE_VARS.상품})
          </p>
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {previewTemplate(value, SAMPLE_VARS)}
          </p>
        </div>
      ) : null}

      {error ? <p className="text-destructive text-sm">{error}</p> : null}

      <div className="flex items-center gap-2">
        <Button type="button" onClick={() => void onSave()} disabled={saving || !hydrated}>
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : saved ? (
            <Check className="size-4" />
          ) : null}
          {saved ? '저장됨' : 'DM 스타일 저장'}
        </Button>
        {value.trim() && !value.includes('[[ai:') ? (
          <span className={cn('text-muted-foreground text-xs')}>
            AI 구간이 없어요 — 개인화하려면 <span className="font-mono">[[ai: …]]</span> 를
            넣으세요.
          </span>
        ) : null}
      </div>
    </div>
  );
}
