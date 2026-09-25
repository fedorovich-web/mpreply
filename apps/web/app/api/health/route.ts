import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json(
    {
      status: "ok",
      app: "mpreply-web",
      version: "0.1.27",
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
