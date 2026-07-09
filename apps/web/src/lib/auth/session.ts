import 'server-only';

import { prisma } from '@scout-os/database';

import { AppError } from '@/lib/api/response';
import { createClient } from '@/lib/supabase/server';
import { type SessionContext } from '@/types/common';

/**
 * Resolves the authenticated principal and their active workspace for server
 * code (route handlers, server actions). Throws `AppError(401)` when there is no
 * session, or `AppError(403)` when the user has no workspace membership.
 *
 * The "active workspace" here defaults to the user's first membership; a real
 * app would read a selected workspace from a cookie or the URL.
 */
export async function requireSession(): Promise<SessionContext> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) throw new AppError('UNAUTHORIZED', 'Not authenticated', 401);

  const membership = await prisma.membership.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
  });

  if (!membership) throw new AppError('NO_WORKSPACE', 'No workspace found for user', 403);

  return {
    userId: user.id,
    email: user.email ?? '',
    workspaceId: membership.workspaceId,
    role: membership.role,
  };
}
