import { encryptPrivateKey } from "../src/features/arca/services/arca-crypto";
import fs from "fs";
import path from "path";

function main() {
  const keyPath = path.join(process.cwd(), ".cert", "nodosur.key");
  if (!fs.existsSync(keyPath)) {
    console.error("❌ No key found at:", keyPath);
    process.exit(1);
  }
  const keyContent = fs.readFileSync(keyPath, "utf8").trim();
  const encrypted = encryptPrivateKey(keyContent);
  console.log("ENCRYPTED_KEY_START");
  console.log(encrypted);
  console.log("ENCRYPTED_KEY_END");
}

main();
