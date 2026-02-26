import { Badge } from "./badge.entity";
import { create } from "ipfs-http-client";

const ipfs = create({ url: "https://ipfs.infura.io:5001" });

export async function uploadBadgeMetadata(badge: Badge) {
  const metadata = {
    name: badge.name,
    description: badge.description,
    image: `ipfs://${badge.imageIpfsHash}`,
    attributes: [{ trait_type: "rarity", value: badge.rarity }],
  };
  const { cid } = await ipfs.add(JSON.stringify(metadata));
  return cid.toString();
}
