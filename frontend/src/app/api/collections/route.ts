import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

export async function GET() {
  try {
    const { data, error } = await supabase.from('collections').select('*');
    if (error) throw error;
    return NextResponse.json({ collections: data });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data, error } = await supabase
      .from('collections')
      .insert([{ id: body.id, name: body.name, code: body.code }])
      .select();

    if (error) throw error;
    return NextResponse.json({ success: true, collection: data[0] });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}