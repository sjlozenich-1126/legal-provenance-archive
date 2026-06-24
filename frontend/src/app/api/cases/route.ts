import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL || '', process.env.SUPABASE_SERVICE_ROLE_KEY || '');

// FETCH ALL RECORDS WITH EMBEDDED MANIFESTS
export async function GET() {
  try {
    const { data, error } = await supabase
      .from('cases')
      .select('*, documents(*)')
      .order('created_at', { ascending: false });

    if (error) throw error;

    // Map database properties to frontend schema expectations
    const formattedCases = data.map((c: any) => ({
      id: c.id,
      title: c.title,
      docketNumber: c.docket_number,
      collectionId: c.collection_id,
      jurisdiction: c.jurisdiction,
      summary: c.summary,
      timestamp: new Date(c.created_at).toISOString().replace('T', ' ').substring(0, 16) + ' UTC',
      documents: c.documents || []
    }));

    return NextResponse.json({ cases: formattedCases });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// GENERATE MASTER RECORD ENTRY
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data, error } = await supabase
      .from('cases')
      .insert([{
        id: body.id,
        title: body.title,
        docket_number: body.docketNumber,
        collection_id: body.collectionId,
        jurisdiction: body.jurisdiction,
        summary: body.summary
      }])
      .select();

    if (error) throw error;
    return NextResponse.json({ success: true, case: { ...data[0], docketNumber: data[0].docket_number, collectionId: data[0].collection_id, documents: [] } });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// UPDATE SCOPE PARTITION / RE-ROUTE FILE
export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { error } = await supabase
      .from('cases')
      .update({ collection_id: body.collectionId })
      .eq('id', body.caseId);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}