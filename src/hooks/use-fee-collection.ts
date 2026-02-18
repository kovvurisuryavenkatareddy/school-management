"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { AcademicYear, StudentDetails, Payment, Invoice, CashierProfile } from "@/types";

export function useFeeCollection() {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [studentRecords, setStudentRecords] = useState<StudentDetails[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [sessionUser, setSessionUser] = useState<User | null>(null);
  const [cashierProfile, setCashierProfile] = useState<CashierProfile | null>(null);
  const [userRole, setUserRole] = useState<'admin' | 'cashier' | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const fetchInitialData = async () => {
      setIsInitializing(true);
      const { data: { user } } = await supabase.auth.getUser();
      setSessionUser(user);

      if (user) {
        const { data: profile } = await supabase.from('cashiers').select('id, name, has_discount_permission, has_expenses_permission, has_revert_permission').eq('user_id', user.id).maybeSingle();
        setCashierProfile(profile);
        if (profile) {
          setUserRole('cashier');
        } else {
          setUserRole('admin');
        }
      }

      const { data, error } = await supabase.from("academic_years").select("*").eq('is_active', true).order("year_name", { ascending: false });
      if (error) toast.error("Failed to fetch academic years.");
      else setAcademicYears(data || []);
      
      setIsInitializing(false);
    };
    fetchInitialData();
  }, []);

  const fetchStudentFinancials = useCallback(async (studentIds: string[]) => {
    if (studentIds.length === 0) {
      setPayments([]);
      setInvoices([]);
      return;
    }
    const [paymentsRes, invoicesRes] = await Promise.all([
      supabase.from('payments').select('*').in('student_id', studentIds).order('created_at', { ascending: false }),
      supabase.from('invoices').select('*').in('student_id', studentIds).eq('status', 'unpaid').order('due_date', { ascending: true })
    ]);

    if (paymentsRes.error) toast.error("Failed to fetch payments.");
    else setPayments(paymentsRes.data as Payment[] || []);

    if (invoicesRes.error) toast.error("Failed to fetch outstanding invoices.");
    else setInvoices(invoicesRes.data as Invoice[] || []);
  }, []);

  const searchStudent = useCallback(async (values: { roll_number: string; academic_year_id?: string }) => {
    setIsSearching(true);
    
    const { data: allStudentRecords, error } = await supabase
      .from("students")
      .select("*, student_types(name), academic_years(*)")
      .eq("roll_number", values.roll_number)
      .order('created_at', { ascending: false });

    if (error || !allStudentRecords || allStudentRecords.length === 0) {
      toast.error("Student not found.");
      setIsSearching(false);
      return;
    }

    if (values.academic_year_id) {
      const recordInYear = allStudentRecords.find(s => s.academic_year_id === values.academic_year_id);
      if (!recordInYear) {
        toast.error(`Student with roll number ${values.roll_number} was not enrolled in the selected academic year.`);
        setIsSearching(false);
        return;
      }
    }

    setStudentRecords(allStudentRecords as StudentDetails[]);
    await fetchStudentFinancials(allStudentRecords.map(s => s.id));
    setIsSearching(false);
  }, [fetchStudentFinancials]);

  const refetchStudent = useCallback(async () => {
    if (studentRecords.length > 0) {
      // Use the roll number from the current records to refresh
      const roll = studentRecords[0].roll_number;
      const { data: allStudentRecords } = await supabase
        .from("students")
        .select("*, student_types(name), academic_years(*)")
        .eq("roll_number", roll)
        .order('created_at', { ascending: false });

      if (allStudentRecords) {
        setStudentRecords(allStudentRecords as StudentDetails[]);
        await fetchStudentFinancials(allStudentRecords.map(s => s.id));
      }
    }
  }, [studentRecords, fetchStudentFinancials]);

  const logActivity = useCallback(async (action: string, details: object, studentId: string) => {
    let currentUser = sessionUser;
    if (!currentUser) {
      const { data } = await supabase.auth.getUser();
      currentUser = data.user;
    }

    if (!currentUser) return;

    await supabase.from('activity_logs').insert({
      cashier_id: cashierProfile?.id || null,
      student_id: studentId,
      action,
      details,
    });
  }, [sessionUser, cashierProfile]);

  const revertPayment = useCallback(async (payment: Payment) => {
    const toastId = toast.loading("Reverting payment...");
    try {
      // 1. Identify if this was an invoice payment
      if (payment.fee_type.toLowerCase().startsWith("invoice:")) {
        const { data: log } = await supabase
          .from('activity_logs')
          .select('details')
          .eq('action', 'Invoice Payment')
          .eq('student_id', payment.student_id)
          .contains('details', { amount: payment.amount })
          .limit(1)
          .maybeSingle();
        
        if (log && log.details.invoice_id) {
          const invId = log.details.invoice_id;
          const { data: invoice } = await supabase.from('invoices').select('paid_amount').eq('id', invId).single();
          
          if (invoice) {
            const newPaid = Math.max(0, (invoice.paid_amount || 0) - payment.amount);
            await supabase.from('invoices').update({ 
                paid_amount: newPaid, 
                status: 'unpaid' 
            }).eq('id', invId);
          }
        }
      }

      // 2. Delete the payment record
      const { error: deleteError } = await supabase.from('payments').delete().eq('id', payment.id);
      if (deleteError) throw deleteError;

      // 3. Log the reversal
      await logActivity("Payment Reversal", { reverted_payment_id: payment.id, amount: payment.amount, fee_type: payment.fee_type }, payment.student_id);

      toast.success("Payment reverted successfully.", { id: toastId });
      
      // 4. Force a clean refresh of local state
      await refetchStudent();
    } catch (err: any) {
      toast.error(`Reversal failed: ${err.message}`, { id: toastId });
    }
  }, [logActivity, refetchStudent]);

  return {
    state: {
      academicYears,
      isSearching,
      studentRecords,
      payments,
      invoices,
      cashierProfile,
      userRole,
      isInitializing,
    },
    actions: {
      searchStudent,
      refetchStudent,
      logActivity,
      revertPayment,
    },
  };
}