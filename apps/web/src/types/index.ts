export * from './common';

// Re-export domain types from the database package so UI code has one import
// surface for entities without depending on Prisma directly.
export type {
  Creator,
  SocialAccount,
  AiAnalysis,
  Campaign,
  Deal,
  OutreachMessage,
  Workspace,
} from '@scout-os/database';

export {
  Platform,
  CreatorType,
  CreatorStatus,
  DealStage,
  MessageKind,
  MessageStatus,
} from '@scout-os/database';
