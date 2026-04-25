import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { code } = await req.json();
    const validCode = process.env.PRO_UNLOCK_CODE;

    if (!validCode) {
      return NextResponse.json({ error: "Unlock not configured." }, { status: 500 });
    }

    if (code === validCode) {
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ success: false, error: "Invalid unlock code." }, { status: 401 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
