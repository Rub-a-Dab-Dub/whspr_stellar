import { TWO_FACTOR_LOGIN_PURPOSE } from './constants';

export interface TwoFactorPendingJwtPayload {
  sub: string;
  walletAddress: string;
  purpose: typeof TWO_FACTOR_LOGIN_PURPOSE;
  iat?: number;
  exp?: number;
}
