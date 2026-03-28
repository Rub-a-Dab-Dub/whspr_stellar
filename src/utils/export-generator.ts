import archiver from "archiver";
import fs from "fs";

export async function generateExportZip(userId: string, requestId: string): Promise<string> {
  const outputPath = `/exports/${requestId}.zip`;
  const output = fs.createWriteStream(outputPath);
  const archive = archiver("zip");

  archive.pipe(output);
  archive.append("User profile data...", { name: "profile.json" });
  archive.append("Messages...", { name: "messages.json" });
  archive.append("Transactions...", { name: "transactions.json" });
  archive.finalize();

  return outputPath;
}
