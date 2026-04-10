import { handleReviewProfessionalApplicationRequest } from './handler.ts';

export const reviewProfessionalApplicationHandler = (req: Request) =>
  handleReviewProfessionalApplicationRequest(req);

Deno.serve(reviewProfessionalApplicationHandler);

