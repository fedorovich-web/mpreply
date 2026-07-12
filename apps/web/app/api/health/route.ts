import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      app: "respio-web",
      version: "0.1.24",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
