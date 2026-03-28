import { LinkPreviewsService } from "../link-previews.service";
import nock from "nock";

describe("LinkPreviewsService", () => {
  it("should parse Open Graph tags", async () => {
    nock("http://example.com")
      .get("/")
      .reply(200, `<meta property="og:title" content="Example Title">`);

    const service = new LinkPreviewsService();
    const preview = await service.fetchPreview("http://example.com");
    expect(preview?.title).toBe("Example Title");
  });

  it("should return null for blocked domains", async () => {
    const service = new LinkPreviewsService();
    const preview = await service.fetchPreview("http://malicious.com");
    expect(preview).toBeNull();
  });
});
