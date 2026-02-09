import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://bgsfijdktrghudhgiceh.supabase.co";

function getAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error("[cashiers-api] Missing SUPABASE_SERVICE_ROLE_KEY");
    throw new Error("Internal credentials missing");
  }
  return createClient(SUPABASE_URL, key, { auth: { persistSession: false } });
}

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getAdminClient();
    const { name, email, phone, has_discount_permission, has_expenses_permission, password } = await request.json();
    
    if (!password) return NextResponse.json({ error: "Password is required." }, { status: 400 });

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes('already registered')) return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 });
      throw authError;
    }
    
    const newUser = authData.user;
    if (!newUser) throw new Error("User could not be created.");

    const { error: cashierError } = await supabaseAdmin
      .from('cashiers')
      .insert({
        user_id: newUser.id,
        name,
        email,
        phone,
        has_discount_permission,
        has_expenses_permission,
        password_change_required: true,
      });

    if (cashierError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.id);
      throw cashierError;
    }

    return NextResponse.json({ message: "Cashier created successfully" }, { status: 200 });
  } catch (error: any) {
    console.error("[cashiers-api] POST Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabaseAdmin = getAdminClient();
    const { user_id, password } = await request.json();
    if (!user_id || !password) return NextResponse.json({ error: "User ID and New Password are required." }, { status: 400 });

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password: password });
    if (authError) throw authError;

    const { error: dbError } = await supabaseAdmin.from('cashiers').update({ password_change_required: true }).eq('user_id', user_id);
    if (dbError) throw dbError;

    return NextResponse.json({ message: "Password updated successfully" }, { status: 200 });
  } catch (error: any) {
    console.error("[cashiers-api] PATCH Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabaseAdmin = getAdminClient();
    const { user_ids } = await request.json();
    if (!user_ids || !Array.isArray(user_ids)) return NextResponse.json({ error: "user_ids array is required." }, { status: 400 });

    for (const id of user_ids) {
      await supabaseAdmin.auth.admin.deleteUser(id);
    }

    return NextResponse.json({ message: `${user_ids.length} cashiers deleted successfully` }, { status: 200 });
  } catch (error: any) {
    console.error("[cashiers-api] DELETE Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}