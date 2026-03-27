import { IsIP, IsNotEmpty } from 'class-validator';

export class BlockIpDto {
  @IsIP()
  @IsNotEmpty()
  ip!: string;
}
