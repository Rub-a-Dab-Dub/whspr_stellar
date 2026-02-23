export class ChannelStatsDto {
  sent: number;
  failed: number;
  opened?: number;
}

export class BroadcastTimelineDto {
  minute: number;
  sent: number;
}

export class BroadcastStatsDto {
  broadcastId: string;
  totalTargeted: number;
  totalSent: number;
  totalFailed: number;
  failedUserIds: string[];
  failedUserIdsExceeded: boolean;
  emailOpenRate: number;
  byChannel: {
    in_app?: ChannelStatsDto;
    email?: ChannelStatsDto;
    push?: ChannelStatsDto;
  };
  timeline: BroadcastTimelineDto[];
}
