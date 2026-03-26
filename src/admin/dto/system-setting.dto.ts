export class CreateSystemSettingDto {
  key: string;
  value: string;
  description?: string;
}

export class UpdateSystemSettingDto {
  value?: string;
  description?: string;
}
