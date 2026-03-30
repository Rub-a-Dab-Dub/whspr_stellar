import { SetMetadata } from '@nestjs/common';

export const FEATURE_FLAG_METADATA_KEY = 'feature_flag';
export const FeatureFlag = (key: string) => SetMetadata(FEATURE_FLAG_METADATA_KEY, key);
