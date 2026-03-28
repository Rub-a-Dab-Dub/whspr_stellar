import { Controller, Get, Query } from "@nestjs/common";
import { LinkPreviewsService } from "./link-previews.service";

@Controller("link-previews")
export class LinkPreviewsController {
  constructor(private readonly service: LinkPreviewsService) {}

  @Get()
  async getPreview(@Query("url") url: string) {
    return this.service.fetchPreview(url);
  }
}
