import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DemoEntry } from "../../components/public-site/DemoEntry";

const router = vi.hoisted(() => ({ replace: vi.fn(), refresh: vi.fn() }));
const apiRequest = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("../../lib/api/client", () => ({ apiRequest }));

describe("DemoEntry", () => {
  beforeEach(() => {
    apiRequest.mockReset().mockResolvedValue({ user: { status: "demo" } });
    router.replace.mockReset();
    router.refresh.mockReset();
  });

  it("opens the demo session and enters the real workspace", async () => {
    render(<DemoEntry locale="ru" />);
    expect(screen.getByRole("heading", { name: "Открываем демо-кабинет MPReply" })).toBeVisible();
    await waitFor(() => expect(apiRequest).toHaveBeenCalledWith("/api/auth/demo", expect.anything(), { method: "POST" }));
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/app/dashboard"));
  });

  it("routes English visitors to the same workspace in English", async () => {
    render(<DemoEntry locale="en" />);
    await waitFor(() => expect(router.replace).toHaveBeenCalledWith("/en/app/dashboard"));
  });
});
