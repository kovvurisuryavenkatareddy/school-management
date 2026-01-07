import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Use environment variables for security on the server
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

export async function POST(request: Request) {
  try {
    const { rollNumber, academicYear } = await request.json();

    if (!rollNumber) {
      return NextResponse.json({ error: "Roll number is required." }, { status: 400 });
    }

    let studentQuery = supabaseAdmin
      .from('students')
      .select('*, student_types(name), academic_years(*)')
      .eq('roll_number', rollNumber)
      .order('created_at', { ascending: false });

    const { data: allStudentRecords, error: studentError } = await studentQuery;

    if (studentError) throw studentError;

    if (!allStudentRecords || allStudentRecords.length === 0) {
      return NextResponse.json({ error: "Student not found." }, { status: 404 });
    }

    if (academicYear) {
      const recordInYear = allStudentRecords.find((s: any) => s.academic_years?.year_name === academicYear);
      if (!recordInYear) {
        return NextResponse.json({ error: `Student was not enrolled in academic year ${academicYear}.` }, { status: 404 });
      }
    }

    const studentIds = allStudentRecords.map((s: any) => s.id);

    const [paymentsRes, invoicesRes] = await Promise.all([
      supabaseAdmin.from('payments').select('*').in('student_id', studentIds).order('created_at', { ascending: false }),
      supabaseAdmin.from('invoices').select('*').in('student_id', studentIds).eq('status', 'unpaid').order('due_date', { ascending: true })
    ]);

    if (paymentsRes.error) throw paymentsRes.error;
    if (invoicesRes.error) throw invoicesRes.error;

    return NextResponse.json({
      studentRecords: allStudentRecords,
      payments: paymentsRes.data,
      invoices: invoicesRes.data,
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}