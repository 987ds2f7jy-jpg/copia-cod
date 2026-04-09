import type { ApiErrorResponse, ApiSuccess, AuthenticatedUser } from '../_shared/types.ts';

export type DeleteUploadedFilesInput = {
  paths: string[];
};

export type DeleteUploadedFilesResult = {
  deletedPaths: string[];
};

export type DeleteUploadedFilesSuccessResponse = ApiSuccess<DeleteUploadedFilesResult>;
export type ErrorResponse = ApiErrorResponse;

export type DeleteUploadedFilesCommand = {
  requestId: string;
  input: DeleteUploadedFilesInput;
  authenticatedUser: AuthenticatedUser;
};
