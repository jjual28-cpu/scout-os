/**
 * Public entry point for the Scout OS database package.
 * Re-exports the shared Prisma client and all generated types/enums so that
 * consumers import from `@scout-os/database` rather than `@prisma/client`
 * directly — keeping the ORM an implementation detail.
 */
export { prisma } from './client';
export { Prisma, PrismaClient } from '@prisma/client';

export type {
  User,
  Workspace,
  Membership,
  Creator,
  SocialAccount,
  SavedSearch,
  Segment,
  DiscoveryRun,
  AiAnalysis,
  Campaign,
  Deal,
  OutreachMessage,
  Note,
  Activity,
  Tag,
  CreatorTag,
} from '@prisma/client';

export {
  Plan,
  Role,
  Platform,
  CreatorType,
  CreatorStatus,
  RunStatus,
  AnalysisKind,
  CampaignStatus,
  DealStage,
  Priority,
  MessageKind,
  MessageStatus,
  ActivityType,
} from '@prisma/client';
