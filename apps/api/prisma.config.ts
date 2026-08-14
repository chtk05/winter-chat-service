// D-031: Prisma 7's CLI (generate, migrate, db:*) no longer reads schema.prisma's
// datasource.url/directUrl or auto-loads .env. This file is that config, and the
// explicit dotenv import below is that env loading, for CLI invocations only — the
// Next.js app itself loads .env through its own mechanism, not through this file.
import "dotenv/config";

import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // @prisma/config@7.9.1's Datasource type has no `directUrl` field yet (only `url` and
  // `shadowDatabaseUrl`) — DIRECT_URL is unused by the CLI at this version. It stays in
  // .env for when that lands.
  datasource: {
    url: env("DATABASE_URL"),
  },
});
