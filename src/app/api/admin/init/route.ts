import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST() {
  try {
    const SUPER_EMAIL = 'superadmin@gmail.com';
    const SUPER_PASS = 'S#uR@y@8341';

    // 1. Check if superadmin already exists in Auth
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const superUser = users.find(u => u.email === SUPER_EMAIL);

    if (!superUser) {
      // 2. Create the user if missing
      const { data, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: SUPER_EMAIL,
        password: SUPER_PASS,
        email_confirm: true,
        user_metadata: { role: 'superadmin' }
      });
      if (createError) throw createError;
      console.log('Super Admin initialized successfully.');
      return NextResponse.json({ message: "Super Admin created" });
    }

    return NextResponse.json({ message: "Super Admin exists" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}