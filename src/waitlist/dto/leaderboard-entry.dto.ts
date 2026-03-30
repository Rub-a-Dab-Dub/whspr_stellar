export class LeaderboardEntryDto {
  position: number;
  email: string; // will be masked in service e.g. us***@gmail.com
  points: number;
  joinedAt: Date;
}