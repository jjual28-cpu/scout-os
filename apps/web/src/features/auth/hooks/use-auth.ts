'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';

import { createClient } from '@/lib/supabase/client';

import { type LoginInput, type SignupInput } from '../schemas';

type AuthState = { loading: boolean; error: string | null };

/**
 * Thin client-side wrapper around Supabase email/password auth. Errors are
 * surfaced as friendly strings so forms can render them inline. Kept resilient:
 * if Supabase is unreachable (e.g. placeholder keys), it fails gracefully with a
 * message rather than throwing — the UI still renders.
 */
export function useAuth() {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({ loading: false, error: null });

  const signIn = useCallback(
    async (input: LoginInput, redirectTo = '/discover') => {
      setState({ loading: true, error: null });
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithPassword(input);
        if (error) {
          setState({ loading: false, error: translateAuthError(error.message) });
          return false;
        }
        router.push(redirectTo);
        router.refresh();
        return true;
      } catch {
        setState({
          loading: false,
          error: '인증 서버에 연결할 수 없습니다. 환경 변수를 확인해 주세요.',
        });
        return false;
      }
    },
    [router],
  );

  const signUp = useCallback(
    async (input: SignupInput, redirectTo = '/discover') => {
      setState({ loading: true, error: null });
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.signUp({
          email: input.email,
          password: input.password,
          options: { data: { full_name: input.fullName } },
        });
        if (error) {
          setState({ loading: false, error: translateAuthError(error.message) });
          return false;
        }
        // When email confirmation is enabled, there is no active session yet.
        if (!data.session) {
          setState({ loading: false, error: null });
          return 'confirm' as const;
        }
        router.push(redirectTo);
        router.refresh();
        return true;
      } catch {
        setState({
          loading: false,
          error: '인증 서버에 연결할 수 없습니다. 환경 변수를 확인해 주세요.',
        });
        return false;
      }
    },
    [router],
  );

  return { ...state, signIn, signUp };
}

function translateAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login credentials')) return '이메일 또는 비밀번호가 올바르지 않습니다';
  if (m.includes('already registered') || m.includes('already exists'))
    return '이미 가입된 이메일입니다';
  if (m.includes('email not confirmed')) return '이메일 인증이 필요합니다';
  return message;
}
