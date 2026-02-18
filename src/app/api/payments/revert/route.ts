import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(request: Request) {
  try {
    const { payment_id } = await request.json();

    if (!payment_id) {
      return NextResponse.json({ error: "Payment ID is required." }, { status: 400 });
    }

    // 1. Fetch the payment record to know its details
    const { data: payment, error: fetchError } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('id', payment_id)
      .single();

    if (fetchError || !payment) {
      return NextResponse.json({ error: "Payment record not found." }, { status: 404 });
    }

    // 2. Handle Invoice linkage if applicable
    if (payment.fee_type.startsWith("Invoice: ")) {
      // Try to find the related invoice from activity logs
      const { data: log } = await supabaseAdmin
        .from('activity_logs')
        .select('details')
        .eq('action', 'Invoice Payment')
        .eq('student_id', payment.student_id)
        .contains('details', { amount: payment.amount })
        .limit(1)
        .maybeSingle();
      
      if (log && log.details.invoice_id) {
        const invId = log.details.invoice_id;
        const { data: invoice } = await supabaseAdmin.from('invoices').select('paid_amount').eq('id', invId).single();
        
        if (invoice) {
          const newPaid = Math.max(0, (invoice.paid_amount || 0) - payment.amount);
          await supabaseAdmin.from('invoices').update({ 
              paid_amount: newPaid, 
              status: 'unpaid' 
          }).eq('id', invId);
        }
      }
    }

    // 3. Delete the payment record
    const { error: deleteError } = await supabaseAdmin
      .from('payments')
      .delete()
      .eq('id', payment_id);

    if (deleteError) throw deleteError;

    return NextResponse.json({ message: "Reverted successfully" });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}