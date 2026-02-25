import { UserRole } from '../../user/entities/user.entity';

export interface JwtPayload {
  sub: string; // userId (UUID)
  walletAddress: string;
  role: UserRole;
  familyId?: string; // token family for reuse detection
  jti?: string; // unique token ID
  iat?: number;
  exp?: number;
}
