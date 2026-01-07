import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// This is a server-side route using secure environment variables.
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(request: Request) {
  try {
    const { name, email, phone, has_discount_permission, has_expenses_permission, password } = await request.json();

    if (!password) {
      return NextResponse.json({ error: "Password is required." }, { status: 400 });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      password: password,
      email_confirm: true,
    });

    if (authError) {
      if (authError.message.includes('already registered')) {
        return NextResponse.json({ error: 'A user with this email already exists.' }, { status: 409 });
      }
      throw authError;
    }
    
    const newUser = authData.user;
    if (!newUser) {
      throw new Error("User could not be created.");
    }

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
      // If creating the profile fails, delete the auth user to prevent orphaned accounts.
      await supabaseAdmin.auth.admin.deleteUser(newUser.id);
      throw cashierError;
    }

    return NextResponse.json({ message: "Cashier created successfully" }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { user_id } = await request.json();

    if (!user_id) {
      return NextResponse.json({ error: "user_id is required." }, { status: 400 });
    }

    const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);

    if (error) {
      throw error;
    }

    return NextResponse.json({ message: "Cashier deleted successfully" }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}