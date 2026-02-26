import { QuestService } from "./quest.service";

const questService = new QuestService();

export async function onMessageSent(userId: string) {
  await questService.incrementProgress(userId, "send_messages_quest", 1);
}

export async function onTipSent(userId: string) {
  await questService.incrementProgress(userId, "tip_users_quest", 1);
}

export async function onRoomJoined(userId: string) {
  await questService.incrementProgress(userId, "join_rooms_quest", 1);
}

export async function onLevelReached(userId: string, level: number) {
  await questService.incrementProgress(userId, "reach_level_quest", level);
}
