/** Public API of the CRM feature. */
export { PipelineBoard } from './components/pipeline-board';
export { DealCard } from './components/deal-card';
export { usePipeline, useUpdateDealStage } from './hooks/use-pipeline';
export {
  PIPELINE_STAGES,
  createDealSchema,
  updateDealStageSchema,
  type CreateDealInput,
  type UpdateDealStageInput,
} from './schemas';
export type { DealWithCreator, PipelineColumns } from './types';
