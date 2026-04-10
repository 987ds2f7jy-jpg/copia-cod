import { handleUpsertProfessionalBankingDataRequest } from './handler.ts';

export const upsertProfessionalBankingDataHandler = (req: Request) =>
  handleUpsertProfessionalBankingDataRequest(req);

Deno.serve(upsertProfessionalBankingDataHandler);

