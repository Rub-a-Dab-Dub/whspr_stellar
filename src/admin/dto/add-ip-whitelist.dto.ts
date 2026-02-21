import { IsString, IsNotEmpty, Matches } from 'class-validator';

export class AddIpWhitelistDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/, {
    message: 'Invalid IP address or CIDR notation',
  })
  ipCidr: string;

  @IsString()
  @IsNotEmpty()
  description: string;
}
