import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST() {
  try {
    // 1. Ensure Super Admins exist
    const SUPERIOR_EMAIL = 'superior@gmail.com';
    const SUPERIOR_PASS = 'S#uR@y@218';
    const SUPER_EMAIL = 'superadmin@gmail.com';
    const SUPER_PASS = 'superadmin@123';

    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const superiorUser = users.find(u => u.email === SUPERIOR_EMAIL);
    if (!superiorUser) {
      await supabaseAdmin.auth.admin.createUser({
        email: SUPERIOR_EMAIL,
        password: SUPERIOR_PASS,
        email_confirm: true,
        user_metadata: { role: 'superior' }
      });
    }

    const superUser = users.find(u => u.email === SUPER_EMAIL);
    if (!superUser) {
      await supabaseAdmin.auth.admin.createUser({
        email: SUPER_EMAIL,
        password: SUPER_PASS,
        email_confirm: true,
        user_metadata: { role: 'superadmin' }
      });
    } else {
      await supabaseAdmin.auth.admin.updateUserById(superUser.id, { password: SUPER_PASS });
    }

    // 2. Ensure School Settings record exists
    const { data: existingSettings } = await supabaseAdmin
      .from('school_settings')
      .select('id')
      .limit(1);

    if (!existingSettings || existingSettings.length === 0) {
      console.log('[init] Creating default school settings...');
      await supabaseAdmin.from('school_settings').insert([{
        school_name: "IDEAL COLLEGE OF ENGINEERING",
        address: "Vidyut Nagar kakinada - 533308",
        is_maintenance_mode: false
      }]);
    }

    return NextResponse.json({ message: "System hierarchy and settings verified." });
  } catch (error: any) {
    console.error('[init] Error:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}