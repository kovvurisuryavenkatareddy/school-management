import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Hardcoded URL for consistency with the client
const SUPABASE_URL = "https://bgsfijdktrghudhgiceh.supabase.co";

function getAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error("[admin-system] Critical: SUPABASE_SERVICE_ROLE_KEY is not defined in environment variables.");
    throw new Error("Internal Server Error: Missing credentials.");
  }
  
  return createClient(SUPABASE_URL, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  });
}

export async function GET() {
  try {
    const supabaseAdmin = getAdminClient();
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    
    if (error) {
      console.error("[admin-system] Supabase error listing users:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: cashiers } = await supabaseAdmin.from('cashiers').select('user_id');
    const cashierIds = new Set(cashiers?.map(c => c.user_id) || []);

    // Filter out the main superior account and anyone who is a cashier
    const admins = users.filter(u => 
      u.email !== 'superior@gmail.com' && !cashierIds.has(u.id)
    );

    return NextResponse.json({ admins });
  } catch (error: any) {
    console.error("[admin-system] GET Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getAdminClient();
    const { email, password, role } = await request.json();

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: role || 'admin' }
    });

    if (error) {
      console.error("[admin-system] Supabase error creating user:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: `${role} created successfully`, user: data.user });
  } catch (error: any) {
    console.error("[admin-system] POST Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabaseAdmin = getAdminClient();
    const { user_id } = await request.json();
    
    if (!user_id) return NextResponse.json({ error: "User ID is required" }, { status: 400 });

    const { data: userRes } = await supabaseAdmin.auth.admin.getUserById(user_id);
    if (userRes?.user?.email === 'superior@gmail.com') {
      return NextResponse.json({ error: "Cannot delete the Superior account." }, { status: 403 });
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (error) {
      console.error("[admin-system] Supabase error deleting user:", error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "User removed" });
  } catch (error: any) {
    console.error("[admin-system] DELETE Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}