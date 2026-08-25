import { describe, expect, it } from "vitest";

import { dynamic as blogDynamic } from "../../app/blog/page";
import { dynamic as resourcesDynamic } from "../../app/resources/page";
import { dynamic as sitemapDynamic } from "../../app/sitemap";

describe("CMS route runtime contract", () => {
  it("keeps CMS-backed lists and sitemap on the runtime server boundary", () => {
    expect(blogDynamic).toBe("force-dynamic");
    expect(resourcesDynamic).toBe("force-dynamic");
    expect(sitemapDynamic).toBe("force-dynamic");
  });
});
