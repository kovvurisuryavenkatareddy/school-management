import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://bgsfijdktrghudhgiceh.supabase.co";

function getAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    console.error("[cashiers-api] CRITICAL: SUPABASE_SERVICE_ROLE_KEY is missing in environment variables.");
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
      return NextResponse.json({ error: "Server configuration error: Service role key not found." }, { status: 500 });
    }

    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json({ error: "Invalid JSON in request body." }, { status: 400 });
    }

    const { name, email, phone, has_discount_permission, has_expenses_permission, has_revert_permission, password } = body;
    
    if (!email || !password || !name) {
      return NextResponse.json({ error: `Missing required fields` }, { status: 400 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { role: 'cashier' }
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        return NextResponse.json({ error: 'A user with this email address is already registered.' }, { status: 409 });
      }
      return NextResponse.json({ error: `Auth Error: ${authError.message}` }, { status: 400 });
    }
    
    const newUser = authData.user;
    if (!newUser) return NextResponse.json({ error: "User creation failed." }, { status: 500 });

    const { error: cashierError } = await supabaseAdmin
      .from('cashiers')
      .insert({
        user_id: newUser.id,
        name,
        email,
        phone: phone || null,
        has_discount_permission: !!has_discount_permission,
        has_expenses_permission: !!has_expenses_permission,
        has_revert_permission: !!has_revert_permission,
        password_change_required: true,
      });

    if (cashierError) {
      await supabaseAdmin.auth.admin.deleteUser(newUser.id);
      return NextResponse.json({ error: `Profile Error: ${cashierError.message}` }, { status: 500 });
    }

    return NextResponse.json({ message: "Cashier account created successfully." }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: "An unexpected internal server error occurred." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabaseAdmin = getAdminClient();
    if (!supabaseAdmin) return NextResponse.json({ error: "Server credentials missing." }, { status: 500 });

    const body = await request.json();
    const { user_id, password } = body;
    
    if (password && user_id) {
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password: password });
        if (authError) return NextResponse.json({ error: `Auth Update Error: ${authError.message}` }, { status: 400 });

        const { error: dbError } = await supabaseAdmin.from('cashiers').update({ password_change_required: true }).eq('user_id', user_id);
        if (dbError) return NextResponse.json({ error: `Database Update Error: ${dbError.message}` }, { status: 500 });

        return NextResponse.json({ message: "Password updated successfully" }, { status: 200 });
    }

    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const supabaseAdmin = getAdminClient();
    if (!supabaseAdmin) return NextResponse.json({ error: "Server credentials missing." }, { status: 500 });

    const { user_ids } = await request.json();
    if (!user_ids || !Array.isArray(user_ids)) return NextResponse.json({ error: "Valid user_ids array is required." }, { status: 400 });

    for (const id of user_ids) {
      await supabaseAdmin.auth.admin.deleteUser(id);
    }

    return NextResponse.json({ message: `${user_ids.length} cashier(s) removed successfully.` }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}