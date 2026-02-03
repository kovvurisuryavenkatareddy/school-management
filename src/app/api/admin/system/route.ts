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

    const { data: cashiers } = await supabaseAdmin.from('cashiers').select('user_id');
    const cashierIds = new Set(cashiers?.map(c => c.user_id) || []);

    // Filter out users who are standard cashiers - we only want to show platform roles here
    const admins = users.filter(u => 
      u.email !== 'superior@gmail.com' && !cashierIds.has(u.id)
    );

    return NextResponse.json({ admins });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { email, password, role } = await request.json();

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role: role || 'admin' }
    });

    if (error) throw error;
    return NextResponse.json({ message: `${role} created successfully` });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { user_id } = await request.json();
    
    // Safety check: Cannot delete superior
    const { data: user } = await supabaseAdmin.auth.admin.getUserById(user_id);
    if (user?.user?.email === 'superior@gmail.com') {
      return NextResponse.json({ error: "Cannot delete the Superior account." }, { status: 403 });
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
    if (error) throw error;
    return NextResponse.json({ message: "User removed" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}