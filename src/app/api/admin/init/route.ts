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

    console.log('[init] Checking for Super Admin...');

    // 1. Check if user exists by listing users (handling pagination is omitted for simplicity as this is a specific check)
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const superUser = users.find(u => u.email === SUPER_EMAIL);

    if (!superUser) {
      console.log('[init] Super Admin not found. Creating now...');
      // 2. Create the user if missing
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: SUPER_EMAIL,
        password: SUPER_PASS,
        email_confirm: true,
        user_metadata: { role: 'superadmin' }
      });
      
      if (createError) throw createError;
      console.log('[init] Super Admin created successfully.');
      return NextResponse.json({ message: "Super Admin created and initialized." });
    }

    console.log('[init] Super Admin already exists.');
    return NextResponse.json({ message: "System already initialized." });
  } catch (error: any) {
    console.error('[init] Error during initialization:', error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}