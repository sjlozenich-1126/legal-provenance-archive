import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Client with administrative rights (Server-Side Only)
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; 
const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const hash = formData.get('hash') as string;
    const caseId = formData.get('caseId') as string;

    if (!file || !hash || !caseId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // 1. Generate unique file path inside the Supabase Object Storage Bucket
    const fileExtension = file.name.split('.').pop();
    const storagePath = `${caseId}/${hash}.${fileExtension}`;

    // 2. Convert File object to ArrayBuffer for uploading binary payload
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 3. Upload raw binary to Supabase Object Storage
    const { data: storageData, error: storageError } = await supabase.storage
      .from('registry-manifests')
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (storageError) throw storageError;

    // 4. Retrieve permanent public URL of the uploaded payload
    const { data: publicUrlData } = supabase.storage
      .from('registry-manifests')
      .getPublicUrl(storagePath);

    const publicUrl = publicUrlData.publicUrl;

    // 5. Commit the metadata ledger record to the Postgres Database
    const { data: dbData, error: dbError } = await supabase
      .from('documents')
      .insert([
        {
          case_id: caseId,
          name: file.name,
          type: file.type.includes('pdf') ? 'pdf' : 'image',
          url: publicUrl,
          hash: hash,
        },
      ])
      .select();

    if (dbError) throw dbError;

    return NextResponse.json({ success: true, document: dbData[0] }, { status: 200 });
  } catch (error: any) {
    console.error('Server Upload Pipeline Failure:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}