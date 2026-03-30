export class MatchedUserDto {
  userId!: string;
  username!: string | null;
  displayName!: string | null;
  avatarUrl!: string | null;
}

export class ImportContactsResponseDto {
  importedCount!: number;
  matchedCount!: number;
  matches!: MatchedUserDto[];
}

export class AddAllMatchedContactsResponseDto {
  totalMatched!: number;
  addedCount!: number;
}
