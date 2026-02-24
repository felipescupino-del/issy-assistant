import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Runtime queries use the pooler URL (DATABASE_URL)
    url: process.env["DATABASE_URL"],
    // Migrations use the direct connection (DIRECT_URL) to bypass the pooler
    directUrl: process.env["DIRECT_URL"],
  },
});
