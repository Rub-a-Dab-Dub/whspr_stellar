export interface NotificationPreferences {
  userId: string;
  enabledTypes: string[]; // e.g. ["TIP_RECEIVED", "MENTION"]
}

export class PreferencesService {
  private prefs: NotificationPreferences[] = [];

  async getPreferences(userId: string) {
    return this.prefs.find((p) => p.userId === userId);
  }

  async setPreferences(userId: string, enabledTypes: string[]) {
    const existing = this.prefs.find((p) => p.userId === userId);
    if (existing) existing.enabledTypes = enabledTypes;
    else this.prefs.push({ userId, enabledTypes });
  }

  async shouldSend(userId: string, type: string) {
    const prefs = await this.getPreferences(userId);
    return prefs ? prefs.enabledTypes.includes(type) : true;
  }
}
