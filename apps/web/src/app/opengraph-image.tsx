import { ImageResponse } from 'next/og';

/**
 * 링크 공유(카카오톡·트위터 등) 미리보기 메인 이미지(og:image). Next.js가 이 파일을
 * 자동으로 og:image / twitter:image 로 연결한다. 1200×630 브랜드 카드.
 * 한글 렌더용 Pretendard woff 를 CDN 에서 로드(satori 는 woff2 미지원).
 */

export const alt = 'Scout OS — 맞는 셀럽만 AI가 찾아드려요';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const FONT_BASE = 'https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/web/static/woff';

async function loadFont(file: string): Promise<ArrayBuffer> {
  const res = await fetch(`${FONT_BASE}/${file}`);
  if (!res.ok) throw new Error(`font load failed: ${file}`);
  return res.arrayBuffer();
}

export default async function Image() {
  const [bold, regular] = await Promise.all([
    loadFont('Pretendard-Bold.woff'),
    loadFont('Pretendard-Regular.woff'),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        background: '#0b1120',
        padding: '76px 80px',
        fontFamily: 'Pretendard',
        position: 'relative',
      }}
    >
      {/* 브랜드 글로우 */}
      <div
        style={{
          position: 'absolute',
          top: -160,
          right: -120,
          width: 620,
          height: 620,
          background: 'radial-gradient(circle, rgba(217,70,239,0.38), transparent 62%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          bottom: -200,
          left: -140,
          width: 640,
          height: 640,
          background: 'radial-gradient(circle, rgba(139,92,246,0.32), transparent 62%)',
        }}
      />

      {/* 로고 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        <div
          style={{
            display: 'flex',
            width: 68,
            height: 68,
            borderRadius: 18,
            background: 'linear-gradient(135deg, #8b5cf6, #d946ef)',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 40,
            fontWeight: 700,
          }}
        >
          S
        </div>
        <div style={{ color: '#fff', fontSize: 40, fontWeight: 700, letterSpacing: -1 }}>
          Scout OS
        </div>
      </div>

      {/* 헤드라인 */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ color: '#fff', fontSize: 92, fontWeight: 700, lineHeight: 1.08 }}>
          맞는 셀럽만,
        </div>
        <div style={{ display: 'flex', fontSize: 92, fontWeight: 700, lineHeight: 1.08 }}>
          <span style={{ color: '#e879f9' }}>AI</span>
          <span style={{ color: '#fff' }}>가 찾아줍니다</span>
        </div>
      </div>

      {/* 서브 */}
      <div style={{ color: '#cbd5e1', fontSize: 34, fontWeight: 400 }}>
        체험단·공구·협찬 셀럽을 AI로 찾고 DM까지 · scout-os.kr
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Pretendard', data: bold, weight: 700, style: 'normal' },
        { name: 'Pretendard', data: regular, weight: 400, style: 'normal' },
      ],
    },
  );
}
