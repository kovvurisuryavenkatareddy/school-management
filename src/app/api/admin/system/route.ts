import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://bgsfijdktrghudhgiceh.supabase.co";

function getAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error("[admin-system] Critical: SUPABASE_SERVICE_ROLE_KEY is not defined.");
    return null;
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
    if (!supabaseAdmin) return NextResponse.json({ error: "Server credentials missing." }, { status: 500 });

    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const { data: cashiers } = await supabaseAdmin.from('cashiers').select('user_id');
    const cashierIds = new Set(cashiers?.map(c => c.user_id) || []);

    const admins = users.filter(u => 
      u.email !== 'superior@gmail.com' && !cashierIds.has(u.id)
    );

    return NextResponse.json({ admins });
  } catch (error: any) {
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getAdminClient();
    if (!supabaseAdmin) return NextResponse.json({ error: "Server credentials missing." }, { status: 500 });

    const { email, password, role } = await request.json();

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: role || 'admin' }
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: `${role} created successfully`, user: data.user });
  } catch (error: any) {
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabaseAdmin = getAdminClient();
    if (!supabaseAdmin) return NextResponse.json({ error: "Server credentials missing." }, { status: 500 });

    const { user_id } = await request.json();
    if (!user_id) return NextResponse.json({ error: "User ID is required" }, { status: 400 });

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ message: "User removed" });
  } catch (error: any) {
    return NextResponse.json({ error: "Unexpected server error." }, { status: 500 });
  }
}