import { UserRole } from '../../user/entities/user.entity';

export interface JwtPayload {
  sub: string; // userId (UUID)
  walletAddress: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}
