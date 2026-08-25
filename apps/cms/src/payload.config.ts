import { postgresAdapter } from "@payloadcms/db-postgres";
import { lexicalEditor } from "@payloadcms/richtext-lexical";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConfig } from "payload";
import sharp from "sharp";

import { Categories } from "./collections/Categories";
import { Content } from "./collections/Content";
import { Media } from "./collections/Media";
import { Users } from "./collections/Users";

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);
const serverURL = process.env.CMS_PUBLIC_URL || "http://localhost:3001";

export default buildConfig({
  admin: {
    user: Users.slug,
    importMap: {
      baseDir: path.resolve(dirname),
    },
    meta: {
      titleSuffix: " — MPReply CMS",
    },
  },
  collections: [Users, Categories, Media, Content],
  cors: [serverURL],
  csrf: [serverURL],
  db: postgresAdapter({
    idType: "uuid",
    migrationDir: path.resolve(dirname, "migrations"),
    pool: {
      connectionString: process.env.CMS_DATABASE_URL || "postgresql://mpreply_cms:mpreply_cms@127.0.0.1:5433/mpreply_cms",
    },
    push: process.env.NODE_ENV !== "production",
  }),
  editor: lexicalEditor(),
  jobs: {
    autoRun: [
      {
        cron: "* * * * *",
        limit: 10,
        queue: "default",
      },
    ],
  },
  secret: process.env.PAYLOAD_SECRET || "local-development-secret-change-before-production",
  serverURL,
  sharp,
  typescript: {
    outputFile: path.resolve(dirname, "payload-types.ts"),
  },
});
