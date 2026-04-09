import { handleDeleteUploadedFilesRequest } from './handler.ts';

export const deleteUploadedFilesHandler = (req: Request) => handleDeleteUploadedFilesRequest(req);

Deno.serve(deleteUploadedFilesHandler);
