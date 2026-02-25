import { IsNotEmpty, IsString, IsNumber, IsPositive, Min, Max, Matches } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class CreateTipDto {
    @ApiProperty({ description: 'UUID of the recipient user' })
    @IsNotEmpty()
    @IsString()
    recipientId: string;

    @ApiProperty({ description: 'Room where the tip was sent' })
    @IsNotEmpty()
    @IsString()
    roomId: string;

    @ApiProperty({ example: 1.5, minimum: 0.00000001, maximum: 1000000000 })
    @IsNumber({ maxDecimalPlaces: 8 })
    @IsPositive()
    @Type(() => Number)
    @Min(0.00000001, { message: 'Amount must be at least 0.00000001' })
    @Max(1000000000, { message: 'Amount cannot exceed 1,000,000,000' })
    amount: number;

    @ApiProperty({ description: 'Token contract address' })
    @IsNotEmpty()
    @IsString()
    tokenAddress: string;

    @ApiProperty({ example: 'a'.repeat(64), description: '64-char hex transaction hash' })
    @IsNotEmpty()
    @IsString()
    @Matches(/^[a-fA-F0-9]{64}$/, {
        message: 'txHash must be 64 hex characters',
    })
    txHash: string;
}
