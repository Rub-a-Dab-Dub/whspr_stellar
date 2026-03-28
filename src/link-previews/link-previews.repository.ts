import { AppDataSource } from "../data-source";
import { LinkPreview } from "./link-preview.entity";

export const linkPreviewRepo = AppDataSource.getRepository(LinkPreview);

export async function savePreview(preview: Partial<LinkPreview>) {
  return linkPreviewRepo.save(preview);
}

export async function findByUrl(url: string) {
  return linkPreviewRepo.findOne({ where: { url } });
}
