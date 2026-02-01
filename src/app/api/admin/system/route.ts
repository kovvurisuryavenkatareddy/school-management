import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function GET() {
  try {
    const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers();
    if (error) throw error;

    // Filter out users who are already in the cashiers table
    const { data: cashiers } = await supabaseAdmin.from('cashiers').select('user_id');
    const cashierIds = new Set(cashiers?.map(c => c.user_id) || []);

    const admins = users.filter(u => 
      u.email !== 'superadmin@gmail.com' && !cashierIds.has(u.id)
    );

    return NextResponse.json({ admins });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: 'admin' }
    });

    if (error) throw error;
    return NextResponse.json({ message: "Admin created" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { user_id } = await request.json();
    const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (error) throw error;
    return NextResponse.json({ message: "Admin deleted" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}