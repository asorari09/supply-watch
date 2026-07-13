import { NextResponse } from "next/server";

export const GET = (): NextResponse<{ ok: true }> =>
  NextResponse.json({ ok: true });
