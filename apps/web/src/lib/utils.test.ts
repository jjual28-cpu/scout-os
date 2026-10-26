import { describe, expect, it } from 'vitest';

import { clipText } from './utils';

describe('clipText', () => {
  it('keeps short text and cuts plain text like slice', () => {
    expect(clipText('캠핑', 10)).toBe('캠핑');
    expect(clipText('abcdef', 3)).toBe('abc');
  });

  it('never leaves half an emoji (10-26: jsonb rejected a lone \\ud83e)', () => {
    const s = '준비해 나가겠습니다.🤍 다음';
    const cut = s.indexOf('🤍') + 1; // slice here would keep only the high surrogate
    expect(s.slice(0, cut)).not.toBe(clipText(s, cut));
    const out = clipText(s, cut);
    expect(out).toBe('준비해 나가겠습니다.');
    expect(() => JSON.parse(JSON.stringify(out))).not.toThrow();
    expect(/[\ud800-\udbff]$/.test(out)).toBe(false);
  });
});
