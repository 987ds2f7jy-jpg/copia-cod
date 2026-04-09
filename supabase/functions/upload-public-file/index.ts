import { handleUploadPublicFileRequest } from './handler.ts';

export const uploadPublicFileHandler = (req: Request) => handleUploadPublicFileRequest(req);

Deno.serve(uploadPublicFileHandler);
