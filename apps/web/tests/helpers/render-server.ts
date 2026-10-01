import type { ReactNode } from "react";
import { renderToReadableStream } from "react-dom/server.edge";

export async function renderServer(element: ReactNode): Promise<string> {
  const stream = await renderToReadableStream(element);
  await stream.allReady;
  return new Response(stream).text();
}
