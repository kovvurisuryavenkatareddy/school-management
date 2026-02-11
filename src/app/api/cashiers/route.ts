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

    const { name, email, phone, has_discount_permission, has_expenses_permission, password } = body;
    
    // Detailed validation logging
    console.log(`[cashiers-api] Received creation request for: ${email}`);

    if (!email || !password || !name) {
      const missing = [];
      if (!email) missing.push("email");
      if (!password) missing.push("password");
      if (!name) missing.push("name");
      return NextResponse.json({ error: `Missing required fields: ${missing.join(", ")}` }, { status: 400 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
      user_metadata: { role: 'cashier' } // Explicitly tag as cashier
    });

    if (authError) {
      console.error("[cashiers-api] Supabase Auth Error:", authError.message, authError.status);
      
      if (authError.message.includes('already registered')) {
        return NextResponse.json({ error: 'A user with this email address is already registered.' }, { status: 409 });
      }
      
      // Return the specific error from Supabase (e.g., password too weak, invalid email)
      return NextResponse.json({ error: `Auth Error: ${authError.message}` }, { status: 400 });
    }
    
    const newUser = authData.user;
    if (!newUser) {
      return NextResponse.json({ error: "User creation succeeded but no user object was returned." }, { status: 500 });
    }

    const { error: cashierError } = await supabaseAdmin
      .from('cashiers')
      .insert({
        user_id: newUser.id,
        name,
        email,
        phone: phone || null,
        has_discount_permission: !!has_discount_permission,
        has_expenses_permission: !!has_expenses_permission,
        password_change_required: true,
      });

    if (cashierError) {
      console.error("[cashiers-api] Database Error:", cashierError.message);
      // Clean up the auth user if profile creation fails to maintain consistency
      await supabaseAdmin.auth.admin.deleteUser(newUser.id);
      return NextResponse.json({ error: `Profile Creation Error: ${cashierError.message}` }, { status: 500 });
    }

    return NextResponse.json({ message: "Cashier account created successfully." }, { status: 200 });
  } catch (error: any) {
    console.error("[cashiers-api] Unexpected Server Error:", error);
    return NextResponse.json({ error: "An unexpected internal server error occurred." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const supabaseAdmin = getAdminClient();
    if (!supabaseAdmin) return NextResponse.json({ error: "Server credentials missing." }, { status: 500 });

    const { user_id, password } = await request.json();
    if (!user_id || !password) return NextResponse.json({ error: "User ID and New Password are required." }, { status: 400 });

    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(user_id, { password: password });
    if (authError) return NextResponse.json({ error: `Auth Update Error: ${authError.message}` }, { status: 400 });

    const { error: dbError } = await supabaseAdmin.from('cashiers').update({ password_change_required: true }).eq('user_id', user_id);
    if (dbError) return NextResponse.json({ error: `Database Update Error: ${dbError.message}` }, { status: 500 });

    return NextResponse.json({ message: "Password updated successfully" }, { status: 200 });
  } catch (error: any) {
    console.error("[cashiers-api] PATCH Error:", error.message);
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
      const { error } = await supabaseAdmin.auth.admin.deleteUser(id);
      if (error) console.error(`[cashiers-api] Failed to delete user ${id}:`, error.message);
    }

    return NextResponse.json({ message: `${user_ids.length} cashier(s) removed successfully.` }, { status: 200 });
  } catch (error: any) {
    console.error("[cashiers-api] DELETE Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}