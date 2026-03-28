import { Controller, Get, Query, Param } from "@nestjs/common";
import { QRCodeService } from "./qr-code.service";

@Controller("qr")
export class QRCodeController {
  constructor(private readonly service: QRCodeService) {}

  @Get("wallet")
  async wallet(@Query("address") address: string) {
    return this.service.generateWalletQR(address);
  }

  @Get("profile/:username")
  async profile(@Param("username") username: string) {
    return this.service.generateProfileQR(username);
  }

  @Get("group/:id")
  async group(@Param("id") id: string) {
    return this.service.generateGroupQR(id);
  }

  @Get("transfer")
  async transfer(@Query("to") to: string, @Query("amount") amount: string, @Query("token") token: string) {
    return this.service.generateTransferQR(to, amount, token);
  }
}
