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
      await supabaseAdmin.auth.admin.createUser({
        email: SUPERIOR_EMAIL,
        password: SUPERIOR_PASS,
        email_confirm: true,
        user_metadata: { role: 'superior' }
      });
    }

    // Update Superadmin credentials as requested
    const SUPER_EMAIL = 'superadmin@gmail.com';
    const SUPER_PASS = 'superadmin@123';
    const superUser = users.find(u => u.email === SUPER_EMAIL);

    if (!superUser) {
      await supabaseAdmin.auth.admin.createUser({
        email: SUPER_EMAIL,
        password: SUPER_PASS,
        email_confirm: true,
        user_metadata: { role: 'superadmin' }
      });
    } else {
      // Sync the requested password change
      await supabaseAdmin.auth.admin.updateUserById(superUser.id, {
        password: SUPER_PASS
      });
    }

    return NextResponse.json({ message: "System hierarchy verified and updated." });
  } catch (error: any) {
    console.error('[init] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}