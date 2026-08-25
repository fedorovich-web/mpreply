/* THIS FILE FOLLOWS THE OFFICIAL PAYLOAD APP ROUTER TEMPLATE. */
import config from "@payload-config";
import "@payloadcms/next/css";
import {
  handleServerFunctions,
  metadata as payloadMetadata,
  RootLayout,
} from "@payloadcms/next/layouts";
import type { ServerFunctionClient } from "payload";
import type { ReactNode } from "react";

import { importMap } from "./admin/importMap.js";
import "./custom.css";

export const metadata = payloadMetadata;

const serverFunction: ServerFunctionClient = async (args) => {
  "use server";
  return handleServerFunctions({ ...args, config, importMap });
};

export default function Layout({ children }: { children: ReactNode }) {
  return (
    <RootLayout config={config} importMap={importMap} serverFunction={serverFunction}>
      {children}
    </RootLayout>
  );
}
