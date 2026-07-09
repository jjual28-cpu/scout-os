/** Public API of the Outreach feature (AI DM + follow-up). */
export { DmComposer } from './components/dm-composer';
export { useGenerateDm } from './hooks/use-generate-dm';
export {
  generateDmInputSchema,
  saveMessageSchema,
  toneEnum,
  type GenerateDmInput,
  type SaveMessageInput,
} from './schemas';
