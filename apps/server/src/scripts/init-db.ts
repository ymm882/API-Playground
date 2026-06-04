import { env } from "../config.js";
import { initDatabase } from "../db/database.js";

initDatabase();

console.log(`SQLite database is ready: ${env.databasePath}`);
