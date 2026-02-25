import { IsNotEmpty, IsString, IsNumber, IsPositive, Min, Max, Matches } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateTipDto {
    @IsNotEmpty()
    @IsString()
    recipientId: string;

    @IsNotEmpty()
    @IsString()
    roomId: string;

    @IsNumber({ maxDecimalPlaces: 8 })
    @IsPositive()
    @Type(() => Number)
    @Min(0.00000001, { message: 'Amount must be at least 0.00000001' })
    @Max(1000000000, { message: 'Amount cannot exceed 1,000,000,000' })
    amount: number;

    @IsNotEmpty()
    @IsString()
    tokenAddress: string;

    @IsNotEmpty()
    @IsString()
    @Matches(/^[a-fA-F0-9]{64}$/, {
        message: 'txHash must be 64 hex characters',
    })
    txHash: string;
}
