import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "../../..");

function resolveFromRepoRoot(input: string) {
  return path.isAbsolute(input) ? input : path.resolve(repoRoot, input);
}

export const env = {
  port: Number(process.env.PORT ?? 8787),
  host: process.env.HOST ?? "0.0.0.0",
  adminToken: process.env.ADMIN_TOKEN ?? "change-me",
  databasePath: resolveFromRepoRoot(process.env.DATABASE_PATH ?? "./data/playground.sqlite")
};
