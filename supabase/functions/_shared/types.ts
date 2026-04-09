export type RequestMeta = {
  requestId: string;
};

export type ApiSuccess<TData> = {
  data: TData;
  meta: RequestMeta;
};

export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
    details?: unknown;
    requestId: string;
  };
};

export type AuthenticatedUser = {
  authUserId: string;
  email?: string | null;
};
