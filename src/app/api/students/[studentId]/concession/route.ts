import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function PATCH(request: Request, { params }: { params: Promise<{ studentId: string }> }) {
  try {
    // Create Supabase admin client inside the handler to avoid build-time execution
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false } }
    );

    const { studentId } = await params;
    const { year, feeItemId, concession } = await request.json();

    if (!studentId || !year || !feeItemId || concession === undefined || concession < 0) {
      return NextResponse.json({ error: "Missing or invalid parameters." }, { status: 400 });
    }

    // 1. Fetch the student's current fee_details
    const { data: student, error: fetchError } = await supabaseAdmin
      .from('students')
      .select('fee_details')
      .eq('id', studentId)
      .single();

    if (fetchError || !student) {
      throw new Error("Student not found.");
    }

    const fee_details = student.fee_details as any || {};
    if (!fee_details[year] || !Array.isArray(fee_details[year])) {
        throw new Error(`Fee structure for year "${year}" not found.`);
    }

    // 2. Find and update the specific fee item
    let itemUpdated = false;
    fee_details[year] = fee_details[year].map((item: any) => {
      if (item.id === feeItemId) {
        item.concession = concession;
        itemUpdated = true;
      }
      return item;
    });

    if (!itemUpdated) {
        throw new Error(`Fee item with ID "${feeItemId}" not found for year "${year}".`);
    }

    // 3. Update the student record with the modified fee_details
    const { error: updateError } = await supabaseAdmin
      .from('students')
      .update({ fee_details })
      .eq('id', studentId);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({ message: "Concession updated successfully" }, { status: 200 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}