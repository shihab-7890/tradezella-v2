import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { error: 'Live Finage data is not implemented yet.' },
    { status: 501 }
  );
}
