export type UserNotification = {
  id: string;
  category: string;
  typeKey: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  relatedEntityType: string | null;
  relatedEntityId: string | null;
  readAt: string | null;
  createdAt: string;
};
