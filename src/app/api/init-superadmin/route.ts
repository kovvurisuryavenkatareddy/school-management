import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET() {
  try {
    const SUPER_ADMIN_EMAIL = 'superadmin@gmail.com';
    const SUPER_ADMIN_PASS = 'S#uR@y@8341';

    // 1. Check if user already exists in Auth
    const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const existingUser = users.users.find(u => u.email === SUPER_ADMIN_EMAIL);

    if (!existingUser) {
      // 2. Create the user
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: SUPER_ADMIN_EMAIL,
        password: SUPER_ADMIN_PASS,
        email_confirm: true,
        user_metadata: { role: 'super_admin' }
      });

      if (createError) throw createError;
      
      // 3. Ensure role mapping in a profiles/roles table if you have one
      // Here we assume roles are managed via user_metadata for efficiency
      
      return NextResponse.json({ message: "Super Admin created successfully." });
    }

    // Update metadata if it was missing
    if (existingUser.user_metadata?.role !== 'super_admin') {
      await supabaseAdmin.auth.admin.updateUserById(existingUser.id, {
        user_metadata: { role: 'super_admin' }
      });
    }

    return NextResponse.json({ message: "Super Admin already exists." });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}