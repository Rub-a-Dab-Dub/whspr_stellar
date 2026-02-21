export class QuestMilestoneEvent {
  constructor(
    public readonly userId: string,
    public readonly questId: string,
    public readonly percentage: number,
  ) {}
}
