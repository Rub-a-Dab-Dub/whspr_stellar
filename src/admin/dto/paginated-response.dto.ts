import { ApiModelProperty } from '@nestjs/swagger';

export class PaginatedMeta {
    @ApiModelProperty()
    total: number;

    @ApiModelProperty()
    page: number;

    @ApiModelProperty()
    limit: number;

    @ApiModelProperty()
    totalPages: number;
}

export class PaginatedResponseDto<T> {
    @ApiModelProperty({ isArray: true })
    data: T[];

    @ApiModelProperty()
    meta: PaginatedMeta;

    constructor(data: T[], total: number, page: number, limit: number) {
        this.data = data;
        this.meta = {
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }
}
