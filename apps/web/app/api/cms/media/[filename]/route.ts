import { readCMSRuntimeConfig } from "../../../../../lib/cms/config";
import { CMSMediaError, fetchCMSMedia } from "../../../../../lib/cms/media";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ filename: string }> },
) {
  const config = readCMSRuntimeConfig();
  if (!config) {
    return Response.json({ error: "cms_unconfigured" }, { status: 503 });
  }

  const { filename } = await params;
  try {
    const media = await fetchCMSMedia(filename, config);
    return new Response(media.body, {
      headers: {
        "cache-control": "public, max-age=86400, stale-while-revalidate=604800",
        "content-type": media.contentType,
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    const status = error instanceof CMSMediaError ? error.status : 502;
    return Response.json({ error: status === 404 ? "media_not_found" : "media_unavailable" }, { status });
  }
}
