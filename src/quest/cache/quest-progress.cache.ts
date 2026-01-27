import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
import { QuestProgress } from '../entities/quest-progress.entity';


@Injectable()
export class QuestProgressCache {
constructor(private readonly redis: Redis) {}


async set(progress: QuestProgress): Promise<void> {
await this.redis.set(
`quest:${progress.userId}:${progress.questId}`,
JSON.stringify(progress),
'EX',
300,
);
}


async get(userId: string, questId: string): Promise<QuestProgress | null> {
const data = await this.redis.get(`quest:${userId}:${questId}`);
return data ? (JSON.parse(data) as QuestProgress) : null;
}
}