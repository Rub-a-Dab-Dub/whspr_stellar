import { SetMetadata } from '@nestjs/common';
import { SKIP_CONSENT_KEY } from '../guards/consent.guard';

/** Mark a route so the ConsentGuard does not enforce ToS acceptance. */
export const SkipConsent = () => SetMetadata(SKIP_CONSENT_KEY, true);
