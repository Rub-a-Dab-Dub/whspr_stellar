export interface UserQuest {
  id: string;
  userId: string;
  questId: string;
  progress: number;
  completedAt?: Date | null;
}
