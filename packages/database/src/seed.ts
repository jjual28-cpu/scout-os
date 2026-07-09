/**
 * Seed script — populates a local/dev database with a demo workspace,
 * a handful of creators across platforms, a campaign, and a couple of deals.
 *
 * Run with: `pnpm db:seed`
 */
import { randomUUID } from 'node:crypto';

import { CampaignStatus, CreatorType, DealStage, Platform, Plan, Role, prisma } from './index';

async function main() {
  console.info('🌱  Seeding Scout OS demo data...');

  // Demo user id — in production this equals a Supabase auth UID.
  const userId = randomUUID();

  const user = await prisma.user.upsert({
    where: { email: 'founder@scout-os.dev' },
    update: {},
    create: {
      id: userId,
      email: 'founder@scout-os.dev',
      fullName: 'Scout Founder',
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: 'Demo Workspace',
      slug: 'demo',
      plan: Plan.PRO,
      ownerId: user.id,
      members: {
        create: { userId: user.id, role: Role.OWNER },
      },
    },
  });

  const creators = await Promise.all(
    [
      {
        displayName: '뷰티 마이크로 크리에이터 A',
        handle: 'beauty_micro_a',
        type: CreatorType.MICRO_CREATOR,
        category: 'beauty',
        niches: ['skincare', 'k-beauty'],
        totalFollowers: 8200,
        avgEngagement: 6.4,
        opportunityScore: 82,
        platform: Platform.INSTAGRAM,
      },
      {
        displayName: '홈트레이닝 유튜버 B',
        handle: 'fit_home_b',
        type: CreatorType.INFLUENCER,
        category: 'fitness',
        niches: ['home-workout', 'diet'],
        totalFollowers: 154000,
        avgEngagement: 3.1,
        opportunityScore: 71,
        platform: Platform.YOUTUBE,
      },
      {
        displayName: '공구 셀러 C',
        handle: 'groupbuy_c',
        type: CreatorType.SELLER,
        category: 'lifestyle',
        niches: ['group-buy', 'kitchen'],
        totalFollowers: 42000,
        avgEngagement: 4.8,
        opportunityScore: 88,
        platform: Platform.INSTAGRAM,
      },
    ].map((c) =>
      prisma.creator.create({
        data: {
          workspaceId: workspace.id,
          type: c.type,
          displayName: c.displayName,
          handle: c.handle,
          category: c.category,
          niches: c.niches,
          totalFollowers: c.totalFollowers,
          avgEngagement: c.avgEngagement,
          opportunityScore: c.opportunityScore,
          source: 'seed',
          socialAccounts: {
            create: {
              platform: c.platform,
              handle: c.handle,
              followers: c.totalFollowers,
              engagementRate: c.avgEngagement,
            },
          },
        },
      }),
    ),
  );

  const campaign = await prisma.campaign.create({
    data: {
      workspaceId: workspace.id,
      name: 'Q3 Summer Launch',
      description: '여름 신제품 런칭을 위한 마이크로 크리에이터 협업',
      status: CampaignStatus.ACTIVE,
      budget: 5_000_000,
    },
  });

  await prisma.deal.create({
    data: {
      workspaceId: workspace.id,
      campaignId: campaign.id,
      creatorId: creators[0]!.id,
      ownerId: user.id,
      stage: DealStage.CONTACTED,
      value: 500_000,
    },
  });

  await prisma.deal.create({
    data: {
      workspaceId: workspace.id,
      campaignId: campaign.id,
      creatorId: creators[2]!.id,
      ownerId: user.id,
      stage: DealStage.NEGOTIATING,
      value: 1_200_000,
    },
  });

  console.info(
    `✅  Seeded workspace "${workspace.name}" with ${creators.length} creators and 1 campaign.`,
  );
}

main()
  .catch((error) => {
    console.error('❌  Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
