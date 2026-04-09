import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';

export type UploadPublicFileResult = {
  file: {
    path: string;
    publicUrl: string;
    originalName: string;
    contentType: string;
    size: number;
  };
};

export type UploadPublicFileSuccessResponse = ApiSuccess<UploadPublicFileResult>;
export type ErrorResponse = ApiErrorResponse;

export type UploadPublicFileCommand = {
  requestId: string;
  folder: string;
  file: File;
  authenticatedUser: AuthenticatedUser;
};
