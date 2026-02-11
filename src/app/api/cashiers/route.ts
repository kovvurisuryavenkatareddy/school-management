import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://bgsfijdktrghudhgiceh.supabase.co";

function getAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error("[cashiers-api] Error: SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.");
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

export async function POST(request: Request) {
  try {
    const supabaseAdmin = getAdminClient();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: "Server configuration error: Service key missing." }, { status: 500 });
    }

    const body = await request.json();
    const { name, email, phone, has_discount_permission, has_expenses_permission, password } = body;
    
    if (!email || !password || !name) {
      return NextResponse.json({ error: "Name, Email and Password are required." }, { status: 400 });
    }

    console.log(`[cashiers-api] Attempting to create user: ${email}`);

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
    });

    if (authError) {
      console.error("[cashiers-api] Auth creation error:", authError.message);
      if (authError.message.includes('already registered')) {
        return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 });
      }
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
    
    const newUser = authData.user;
    if (!newUser) {
      return NextResponse.json({ error: "User object returned as null." }, { status: 500 });
    }

    const { error: cashierError } = await supabaseAdmin
      .from('cashiers')
      .insert({
        user_id: newUser.id,
        name,
        email,
        phone,
        has_discount_permission: !!has_discount_permission,
        has_expenses_permission: !!has_expenses_permission,
        password_change_required: true,
      });

    if (cashierError) {
      console.error("[cashiers-api] Database profile creation error:", cashierError.message);
      // Rollback: delete the auth user if profile creation fails
      await supabaseAdmin.auth.admin.deleteUser(newUser.id);
      return NextResponse.json({ error: `Profile error: ${cashierError.message}` }, { status: 500 });
    }

    return NextResponse.json({ message: "Cashier account created successfully." }, { status: 200 });
  } catch (error: any) {
    console.error("[cashiers-api] Unexpected POST Error:", error);
    return NextResponse.json({ error: "An internal server error occurred." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabaseAdmin = getAdminClient();
    if (!supabaseAdmin) return NextResponse.json({ error: "Service key missing." }, { status: 500 });

    const { user_id, password } = await request.json();
    if (!user_id || !password) return NextResponse.json({ error: "User ID and New Password are required." }, { status: 400 });

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password: password });
    if (authError) return NextResponse.json({ error: authError.message }, { status: 400 });

    const { error: dbError } = await supabaseAdmin.from('cashiers').update({ password_change_required: true }).eq('user_id', user_id);
    if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 });

    return NextResponse.json({ message: "Password updated successfully" }, { status: 200 });
  } catch (error: any) {
    console.error("[cashiers-api] PATCH Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabaseAdmin = getAdminClient();
    if (!supabaseAdmin) return NextResponse.json({ error: "Service key missing." }, { status: 500 });

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