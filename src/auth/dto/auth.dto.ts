import { IsString, IsNotEmpty, Length, Matches } from 'class-validator';

// ─── POST /auth/nonce ─────────────────────────────────────────────────────────

export class NonceRequestDto {
  @IsString()
  @IsNotEmpty()
  @Length(42, 42, {
    message: 'walletAddress must be a 42-character EVM address',
  })
  @Matches(/^0x[0-9a-fA-F]{40}$/, {
    message: 'walletAddress must be a valid EVM hex address starting with 0x',
  })
  walletAddress: string;
}

// ─── POST /auth/verify ───────────────────────────────────────────────────────

export class VerifySignatureDto {
  @IsString()
  @IsNotEmpty()
  @Length(42, 42)
  @Matches(/^0x[0-9a-fA-F]{40}$/)
  walletAddress: string;

  @IsString()
  @IsNotEmpty()
  signature: string; // Hex-encoded EIP-191 signature (0x...)
}

// ─── POST /auth/refresh ──────────────────────────────────────────────────────

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}
