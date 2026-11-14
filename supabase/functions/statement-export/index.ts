import { createClient } from '@supabase/supabase-js';

// Initialize Supabase Admin client with service role key for server-side operations
// This allows uploading to storage and bypassing RLS
const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

interface GenerateStatementParams {
  vendorId: string;
  period: 'daily' | 'weekly' | 'monthly';
  startDate?: string;
  endDate?: string;
  format: 'csv' | 'json' | 'pdf';
}

interface StatementResponse {
  statement_id: string;
  status: 'generating' | 'completed' | 'failed';
  message: string;
  download_url?: string;
  format: string;
  metadata: {
    total_transactions: number;
    total_amount: number;
    total_fee: number;
    total_vendor_earnings: number;
  };
}

// Helper: Get date range
function getDateRange(
  period: 'daily' | 'weekly' | 'monthly',
  startDate?: string,
  endDate?: string
): { start: string; end: string } {
  const now = new Date();
  const end = endDate ? new Date(endDate) : now;

  let start: Date;

  switch (period) {
    case 'daily':
      start = new Date(end.getFullYear(), end.getMonth(), end.getDate());
      break;
    case 'weekly':
      const day = end.getDay();
      const sunday = new Date(end);
      sunday.setDate(end.getDate() - day);
      start = new Date(sunday);
      start.setDate(start.getDate() - 6);
      break;
    case 'monthly':
      start = new Date(end.getFullYear(), end.getMonth(), 1);
      break;
    default:
      start = new Date(end.getFullYear(), end.getMonth(), 1);
  }

  if (startDate) start = new Date(startDate);
  if (endDate) end = new Date(endDate);

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  };
}

// Helper: Transform transaction to statement entry
function transformTransaction(tx: any): StatementEntry {
  let vendorShare = 0;
  let platformFee = 0;

  if (tx.vendor_total !== null && tx.vendor_total !== undefined) {
    vendorShare = parseFloat(tx.vendor_total.toString());
  } else if (tx.total_amount !== null && tx.sub_merchants?.settlement_percentage !== null) {
    const settlementPct = parseFloat(tx.sub_merchants.settlement_percentage.toString());
    vendorShare = parseFloat(tx.total_amount.toString()) * (settlementPct / 100);
    platformFee = parseFloat(tx.total_amount.toString()) - vendorShare;
  } else {
    vendorShare = parseFloat(tx.total_amount.toString()) * 0.2;
    platformFee = parseFloat(tx.total_amount.toString()) - vendorShare;
  }

  if (!platformFee && tx.platform_fee !== null && tx.platform_fee !== undefined) {
    platformFee = parseFloat(tx.platform_fee.toString());
    vendorShare = parseFloat(tx.total_amount.toString()) - platformFee;
  } else if (!platformFee) {
    platformFee = (parseFloat(tx.total_amount.toString()) - vendorShare).toFixed(2);
  }

  return {
    date: `${new Date(tx.created_at).getFullYear()}-${(new Date(tx.created_at).getMonth() + 1)
      .toString()
      .padStart(2, '0')}-${new Date(tx.created_at).getDate().toString().padStart(2, '0')}`,
    type: tx.status === 'completed' ? 'sale' : tx.status === 'refund' ? 'refund' : 'payout',
    amount: parseFloat(tx.total_amount.toString()) || 0,
    currency: tx.currency || 'SAR',
    platform_fee: platformFee || 0,
    vendor_share: vendorShare || 0,
    status: tx.status,
    order_id: tx.order_id || tx.myfatoorah_transaction_id || '',
    customer_name: tx.customer?.customer_name || null,
  };
}

// Helper: Generate CSV
function generateCSV(entries: any[]): string {
  if (entries.length === 0) {
    return 'Date,Type,Amount (SAR),Platform Fee,Vendor Share,Status,Order ID,Customer Name\n';
  }

  const header = 'Date,Type,Amount (SAR),Platform Fee,Vendor Share,Status,Order ID,Customer Name';
  const rows = entries.map((entry) =>
    [entry.date, entry.type, entry.amount.toFixed(2), entry.platform_fee.toFixed(2), entry.vendor_share.toFixed(2), entry.status, `"${entry.order_id}"`, `"${entry.customer_name || ''}"`].join(',')
  );

  return [header, ...rows].join('\n');
}

// Helper: Generate JSON
function generateJSON(entries: any[], metadata: any): string {
  return JSON.stringify({
    generated_at: new Date().toISOString(),
    total_transactions: metadata.total_transactions,
    total_amount: metadata.total_amount,
    total_fee: metadata.total_fee,
    total_vendor_earnings: metadata.total_vendor_earnings,
    entries,
  }, null, 2);
}

// Helper: Simple PDF generation (text-based)
function generatePDFContent(entries: any[], metadata: any, currency: string): string {
  const lines: string[] = [];
  lines.push('========================================');
  lines.push('  GIFTLY VENDOR STATEMENT');
  lines.push('========================================');
  lines.push('');
  lines.push(`Generated: ${new Date().toLocaleDateString()}`);
  lines.push(`Period: ${entries.length > 0 ? entries[0].date : 'N/A'}`);
  lines.push(`Currency: ${currency}`);
  lines.push('');
  lines.push('SUMMARY');
  lines.push('----------------------------------------');
  lines.push(`Total Transactions: ${metadata.total_transactions}`);
  lines.push(`Total Amount: ${metadata.total_amount.toFixed(2)} ${currency}`);
  lines.push(`Platform Fees: ${metadata.total_fee.toFixed(2)} ${currency}`);
  lines.push(`Vendor Earnings: ${metadata.total_vendor_earnings.toFixed(2)} ${currency}`);
  lines.push(`Net Payout: ${(metadata.total_vendor_earnings - metadata.total_fee).toFixed(2)} ${currency}`);
  lines.push('');
  lines.push('TRANSACTIONS');
  lines.push('----------------------------------------');
  lines.push('Date        | Type     | Amount   | Fee      | Vendor Share | Status');
  lines.push('----------------------------------------');

  const sortedEntries = [...entries].sort((a, b) => b.date - a.date);
  const displayEntries = sortedEntries.slice(0, 10);
  const remainingCount = sortedEntries.length - displayEntries.length;

  displayEntries.forEach((entry) => {
    const amountDisplay = entry.amount.toFixed(2);
    const feeDisplay = entry.platform_fee.toFixed(2);
    const vendorDisplay = entry.vendor_share.toFixed(2);
    const typeDisplay = entry.type.charAt(0).toUpperCase() + entry.type.slice(1);
    lines.push(`${entry.date.padEnd(10)} | ${typeDisplay.padEnd(8)} | ${amountDisplay.padEnd(8)} | ${feeDisplay.padEnd(8)} | ${vendorDisplay.padEnd(14)} | ${entry.status}`);
  });

  if (remainingCount > 0) {
    lines.push(`... and ${remainingCount} more transactions`);
  }

  lines.push('----------------------------------------');
  lines.push(`Total above shows ${displayEntries.length} of ${sortedEntries.length} transactions`);
  lines.push('========================================');

  return lines.join('\n');
}

// Deno handler for the function
export default serve(async (req: Request): Promise<Response> => {
  try {
    // Only accept POST
    if (req.method !== 'POST') {
      const errorResponse = new Response(
        JSON.stringify({ error: 'Method not allowed. Use POST.' }),
        { status: 405, headers: { 'Content-Type': 'application/json' } }
      );
      return errorResponse;
    }

    // Parse request body
    const body = await req.json();
    const { vendorId, period, startDate, endDate, format } = body as GenerateStatementParams;

    // Validate required fields
    if (!vendorId || !period || !format) {
      const errorResponse = new Response(
        JSON.stringify({ error: 'Missing required fields: vendorId, period, format' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
      return errorResponse;
    }

    // Validate period
    const validPeriods = ['daily', 'weekly', 'monthly'];
    if (!validPeriods.includes(period)) {
      const errorResponse = new Response(
        JSON.stringify({ error: `Invalid period. Must be one of: ${validPeriods.join(', ')}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
      return errorResponse;
    }

    // Validate format
    const validFormats = ['csv', 'json', 'pdf'];
    if (!validFormats.includes(format)) {
      const errorResponse = new Response(
        JSON.stringify({ error: `Invalid format. Must be one of: ${validFormats.join(', ')}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
      return errorResponse;
    }

    // Get date range
    const { start, end } = getDateRange(period, startDate, endDate);

    // Fetch transactions for this vendor within the date range
    // Note: RLS may filter based on the anon key, but since we're using service role key,
    // we get all transactions. We'll filter by vendorId manually.
    const { data: transactions, error: txError } = await supabase
      .from('transactions')
      .select('*')
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true });

    if (txError) {
      const errorResponse = new Response(
        JSON.stringify({ error: 'Failed to fetch transactions', details: txError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
      return errorResponse;
    }

    // Filter transactions for this vendor (vendorId comes from sub_merchants link)
    // We need to link transactions to vendors via the sub_merchants relationship
    // For simplicity, we'll use the first transaction's sub_merchants info to determine the vendor
    // In a production app, you'd have a more direct link
    const vendorTransactions = transactions?.filter((tx: any) => 
      tx.sub_merchants?.id === vendorId || tx.vendor_id === vendorId
    ) || [];

    // Calculate metadata
    const transactionCount = vendorTransactions.length;
    const metadata = {
      total_transactions: transactionCount,
      total_amount: vendorTransactions.reduce((sum: number, tx: any) => sum + (tx.total_amount || 0), 0),
      total_fee: vendorTransactions.reduce((sum: number, tx: any) => sum + (tx.platform_fee || 0), 0),
      total_vendor_earnings: vendorTransactions.reduce((sum: number, tx: any) => sum + (tx.vendor_total || 0), 0),
    };

    // Generate content based on format
    let content: string;

    if (format === 'csv') {
      content = generateCSV(vendorTransactions);
    } else if (format === 'json') {
      content = generateJSON(vendorTransactions, metadata);
    } else if (format === 'pdf') {
      // Get currency from the first transaction or default to SAR
      const currency = vendorTransactions.length > 0 ? vendorTransactions[0].currency || 'SAR' : 'SAR';
      content = generatePDFContent(vendorTransactions, metadata, currency);
    }

    // Upload to Supabase Storage
    const fileName = `statements/${vendorId}/${Date.now()}.${format}`;
    
    // Determine content type
    const contentType = format === 'csv' 
      ? 'text/csv' : format === 'json' 
        ? 'application/json' 
        : 'text/plain';

    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('your-storage-bucket') // TODO: Replace with your actual bucket name
      .upload(fileName, content, {
        contentType,
    });

    if (uploadError) {
      const errorResponse = new Response(
        JSON.stringify({ error: 'Failed to upload statement', details: uploadError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
      return errorResponse;
    }

    // Get public URL for the uploaded file
    const { data: urlData } = await supabase
      .storage
      .from('your-storage-bucket') // TODO: Replace with your actual bucket name
      .getPublicUrl(fileName);

    // Prepare response
    const response: StatementResponse = {
      statement_id: Date.now().toString(),
      status: 'completed',
      message: 'Statement generated successfully',
      download_url: urlData.publicUrl,
      format,
      metadata,
    };

    const successResponse = new Response(
      JSON.stringify(response),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
    return successResponse;
  } catch (error: any) {
    console.error('Error in statement-export function:', error);
    const errorResponse = new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
    return errorResponse;
  }
});