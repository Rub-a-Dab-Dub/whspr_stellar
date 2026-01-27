import { Controller, Post, Body, Req } from '@nestjs/common';
import { MetaTxService } from '../services/meta-tx.service';

@Controller('gasless')
export class GaslessController {
  constructor(private readonly metaTx: MetaTxService) {}

  @Post('submit')
  async submit(
    @Req() req: any,
    @Body() body: { xdr: string; publicKey: string },
  ) {
    return this.metaTx.submit(req.user.id, body.publicKey, body.xdr);
  }
}
