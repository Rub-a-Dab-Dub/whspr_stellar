import { IsString, IsOptional, MinLength } from 'class-validator';

export class DistributeKeyDto {
  @IsString()
  memberId: string;

  /**
   * Member's base64-encoded public key (e.g. X25519 or RSA-OAEP) used to
   * seal the group key on the server side before storing the bundle.
   * Optional – when omitted the server stores a base64 fallback.
   */
  @IsString()
  @MinLength(10)
  @IsOptional()
  publicKey?: string;

  @IsString()
  @IsOptional()
  deviceId?: string;
}

export class RotateKeyResponseDto {
  groupId: string;
  newKeyVersion: number;
  distributedTo: number;
}

export class KeyVersionResponseDto {
  groupId: string;
  keyVersion: number;
  isActive: boolean;
}

export class KeyBundleResponseDto {
  groupId: string;
  memberId: string;
  keyVersion: number;
  encryptedGroupKey: string;
  deviceId: string;
}
