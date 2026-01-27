export class QuestCompletedEvent {
constructor(public readonly userId: string, public readonly questId: string) {}
}