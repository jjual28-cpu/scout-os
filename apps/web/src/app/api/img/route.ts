import { type NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * 이미지 프록시 — 인스타 프로필/게시물 이미지는 CDN이 핫링크(referer)를 차단해서
 * 브라우저의 <img>로 직접 부르면 일부가 안 뜬다. 서버가 대신 받아와 스트리밍하면
 * referer 문제 없이 전부 뜬다. SSRF 방지로 인스타/FB CDN 호스트만 허용한다.
 */
const ALLOWED_HOST = /(^|\.)(cdninstagram\.com|fbcdn\.net|instagram\.com)$/i;

export const GET = async (request: NextRequest) => {
  const u = request.nextUrl.searchParams.get('u');
  if (!u) return new NextResponse('missing url', { status: 400 });

  let target: URL;
  try {
    target = new URL(u);
  } catch {
    return new NextResponse('bad url', { status: 400 });
  }
  if (target.protocol !== 'https:' || !ALLOWED_HOST.test(target.hostname)) {
    return new NextResponse('forbidden host', { status: 403 });
  }

  try {
    const res = await fetch(target.toString(), {
      headers: {
        // 인스타 CDN은 referer/UA 로 핫링크를 막으므로 인스타에서 온 것처럼 보낸다.
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36',
        Referer: 'https://www.instagram.com/',
      },
    });
    if (!res.ok) return new NextResponse('upstream error', { status: 502 });
    const buf = await res.arrayBuffer();
    return new NextResponse(buf, {
      status: 200,
      headers: {
        'content-type': res.headers.get('content-type') ?? 'image/jpeg',
        // 하루 캐시 — 같은 이미지를 매번 다시 안 받게.
        'cache-control': 'public, max-age=86400, s-maxage=86400',
      },
    });
  } catch {
    return new NextResponse('fetch failed', { status: 502 });
  }
};
