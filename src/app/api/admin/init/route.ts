import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST() {
  try {
    const SUPERIOR_EMAIL = 'superior@gmail.com';
    const SUPERIOR_PASS = 'S#uR@y@218';

    console.log('[init] Checking for Superior Admin...');

    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const superiorUser = users.find(u => u.email === SUPERIOR_EMAIL);

    if (!superiorUser) {
      console.log('[init] Superior not found. Creating now...');
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: SUPERIOR_EMAIL,
        password: SUPERIOR_PASS,
        email_confirm: true,
        user_metadata: { role: 'superior' }
      });
      
      if (createError) throw createError;
      return NextResponse.json({ message: "Superior account initialized." });
    }

    // Also ensure Superadmin exists if you want to keep that logic
    const SUPER_EMAIL = 'superadmin@gmail.com';
    const SUPER_PASS = 'S#uR@y@8341';
    const superUser = users.find(u => u.email === SUPER_EMAIL);

    if (!superUser) {
      await supabaseAdmin.auth.admin.createUser({
        email: SUPER_EMAIL,
        password: SUPER_PASS,
        email_confirm: true,
        user_metadata: { role: 'superadmin' }
      });
    }

    return NextResponse.json({ message: "System hierarchy verified." });
  } catch (error: any) {
    console.error('[init] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}