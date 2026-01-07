import { Payment, StudentDetails } from "@/types";

export function generateReceiptHtml(student: StudentDetails, payment: Payment, cashierName: string | null): string {
  const paymentDate = new Date(payment.created_at).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  const receiptNo = String(payment.receipt_number).padStart(6, '0');

  const paymentDetailsRow = payment.payment_method === 'upi' && payment.utr_number
    ? `<strong>Payment Mode:</strong> UPI | <strong>UTR:</strong> ${payment.utr_number}`
    : `<strong>Payment Mode:</strong> Cash`;

  const createCopy = (copyType: "College Copy" | "Student Copy") => {
    const title = copyType;
    const cashierRow = copyType === 'College Copy' && cashierName
      ? `<tr><td colspan="4" class="meta-info"><strong>Cashier Name:</strong> ${cashierName}</td></tr>`
      : '';

    return `
      <div class="receipt-container">
        <div class="receipt-title">${title}</div>
        <header>
          <div class="logo-placeholder"></div>
          <div class="header-text">
            <h1>IDEAL COLLEGE OF ENGINEERING</h1>
            <p>Vidyut Nagar kakinada - 533308</p>
          </div>
        </header>
        <section class="main-content">
          <table class="info-table">
            ${cashierRow}
            <tr>
              <td colspan="2" class="meta-info">
                <strong>FEE RECEIPT</strong>
              </td>
              <td colspan="2" class="meta-info text-right">
                <strong>Receipt No:</strong> ${receiptNo}<br/>
                <strong>Date:</strong> ${paymentDate}
              </td>
            </tr>
            <tr>
              <td><strong>REG NO</strong></td>
              <td><strong>Student Name</strong></td>
              <td><strong>Class & Section</strong></td>
              <td><strong>year of study</strong></td>
            </tr>
            <tr>
              <td>${student.roll_number}</td>
              <td>${student.name}</td>
              <td>${student.class} - ${student.section}</td>
              <td>${student.studying_year}</td>
            </tr>
            <tr>
              <td colspan="2"><strong>Fee Type/Name:</strong> ${payment.fee_type}</td>
              <td colspan="2" class="text-right"><strong>Amount</strong><br/>Rs.${payment.amount.toFixed(2)}</td>
            </tr>
            <tr>
              <td colspan="4">${paymentDetailsRow}</td>
            </tr>
          </table>
          <div class="total-paid">
            <strong>Total Paid Amount:</strong>
            <strong>Rs.${payment.amount.toFixed(2)}/-</strong>
          </div>
        </section>
        <footer>
          <p>Note: This fee receipt was electronically generated no signature required</p>
        </footer>
      </div>
    `;
  };

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <title>Fee Receipt</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Arial, sans-serif');
        html, body {
          height: 100%;
          font-family: Arial, sans-serif;
          margin: 0;
          padding: 0;
          background-color: #fff;
          -webkit-print-color-adjust: exact;
          color-adjust: exact;
        }
        .print-container {
          display: flex;
          flex-direction: column;
          height: 100vh;
          width: 100%;
          page-break-after: avoid;
          page-break-inside: avoid;
        }
        .receipt-wrapper {
          height: 48%;
          box-sizing: border-box;
          page-break-inside: avoid;
          page-break-after: avoid;
          padding: 0.5cm;
        }
        .receipt-container {
          height: 100%;
          display: flex;
          flex-direction: column;
          border: 2px solid #000;
          padding: 12px;
          font-size: 12px;
          color: #000;
          background-color: #fff;
        }
        .receipt-title { text-align: center; font-size: 16px; font-weight: bold; margin-bottom: 8px; }
        header { display: flex; align-items: center; padding-bottom: 8px; border-bottom: 2px solid #000; }
        .logo-placeholder { width: 60px; height: 60px; border: 1px solid #ccc; margin-right: 16px; flex-shrink: 0; }
        .header-text { flex-grow: 1; text-align: center; }
        .header-text h1 { font-size: 18px; font-weight: bold; margin: 0; }
        .header-text p { margin: 0; font-size: 11px; }
        .main-content { padding: 8px 0; }
        .info-table { width: 100%; border-collapse: collapse; }
        .info-table td { border: 1px solid #000; padding: 6px; vertical-align: top; }
        .info-table strong { font-weight: bold; }
        .meta-info { border: none !important; padding: 8px 0; }
        .text-right { text-align: right; }
        .total-paid { display: flex; justify-content: flex-end; padding: 12px 6px; font-size: 14px; }
        .total-paid strong:first-child { margin-right: 16px; }
        footer {
          border-top: 2px solid #000;
          padding-top: 6px;
          padding-bottom: 4px;
          text-align: center;
          font-size: 10px;
        }
        @page { 
          size: A4; 
          margin: 0; 
        }
        @media print {
          .print-container {
            page-break-after: avoid;
            page-break-inside: avoid;
          }
          .receipt-wrapper {
            page-break-inside: avoid;
            page-break-after: avoid;
          }
        }
      </style>
    </head>
    <body>
      <div class="print-container">
        <div class="receipt-wrapper">${createCopy("College Copy")}</div>
        <div class="receipt-wrapper">${createCopy("Student Copy")}</div>
      </div>
    </body>
    </html>
  `;
}