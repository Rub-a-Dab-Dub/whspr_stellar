import { Provider } from '@nestjs/common';
import * as admin from 'firebase-admin';
import { ConfigService } from '@nestjs/config';

export const FIREBASE_ADMIN = 'FIREBASE_ADMIN';

export const FirebaseAdminProvider: Provider = {
  provide: FIREBASE_ADMIN,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const existingApp = admin.apps.find((a) => a?.name === '[DEFAULT]');
    if (existingApp) return existingApp;

    const serviceAccountJson = configService.get<string>(
      'FIREBASE_SERVICE_ACCOUNT_JSON',
    );
    const projectId = configService.get<string>('FIREBASE_PROJECT_ID');

    if (serviceAccountJson) {
      const serviceAccount = JSON.parse(serviceAccountJson);
      return admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    if (projectId) {
      return admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId,
      });
    }

    throw new Error(
      'Firebase configuration missing: set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_PROJECT_ID',
    );
  },
};
