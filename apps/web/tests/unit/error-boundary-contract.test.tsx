import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import RootError from "../../app/error";
import GlobalError from "../../app/global-error";
import WorkspaceError from "../../app/app/error";

describe("error boundaries contract", () => {
  it("renders root error boundary with localized seller-facing copy and recovery actions", () => {
    const error = Object.assign(new Error("Test runtime failure"), { digest: "DIGEST-1234" });
    const reset = vi.fn();

    const html = renderToStaticMarkup(<RootError error={error} reset={reset} />);
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelector("h1")?.textContent).toBe("Произошла непредвиденная ошибка");
    expect(html).toContain("DIGEST-1234");
    expect(html).toContain("Повторить попытку");
    expect(html).toContain("На главную");
    // Verify no raw stack trace leaked
    expect(html).not.toContain("Test runtime failure");
  });

  it("renders global error boundary with standalone html/body structure", () => {
    const error = Object.assign(new Error("Layout rendering crashed"), { digest: "GLOBAL-ERR-999" });
    const reset = vi.fn();

    const html = renderToStaticMarkup(<GlobalError error={error} reset={reset} />);

    expect(html).toContain("<html");
    expect(html).toContain("<body");
    expect(html).toContain("Критический сбой приложения");
    expect(html).toContain("GLOBAL-ERR-999");
    expect(html).toContain("Повторить попытку");
    expect(html).toContain("На главную");
    // Verify no raw stack trace leaked
    expect(html).not.toContain("Layout rendering crashed");
  });

  it("renders workspace error boundary with operational dashboard messaging", () => {
    const error = Object.assign(new Error("Network timeout in inbox"), { digest: "WS-ERR-500" });
    const reset = vi.fn();

    const html = renderToStaticMarkup(<WorkspaceError error={error} reset={reset} />);
    const doc = new DOMParser().parseFromString(html, "text/html");

    expect(doc.querySelector("h2")?.textContent).toBe("Не удалось загрузить раздел рабочей области");
    expect(html).toContain("WS-ERR-500");
    expect(html).toContain("Повторить попытку");
    expect(html).toContain("В дашборд");
    expect(html).toContain("/app/dashboard");
    // Verify no raw stack trace leaked
    expect(html).not.toContain("Network timeout in inbox");
  });
});
