'use server';

import { str, optional, back, moneyField, intField, checkbox } from './_form';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function submitContact(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const subject = String(formData.get('subject') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();
  if (!name || !email || !message) {
    back('/contact', 'Please fill in your name, email and message.');
  }

  const supabase = await createClient();
  // Same RLS wall as /account-deletion: a visitor cannot read back the row they
  // just inserted, and PostgREST turns that into an insert failure. This RPC is
  // the public entry point; it derives the ticket reference and the identity.
  // The email is part of the body, not the reference, so a ticket never shows
  // two conflicting identities.
  const { error } = await supabase.rpc('submit_contact_request', {
    p_name: name,
    p_email: email,
    p_subject: subject || null,
    p_message: message,
  });
  if (error) {
    const friendly = error.message.includes('invalid_email')
      ? 'Enter a valid email address.'
      : error.message.includes('invalid_message')
        ? 'Please write a message under 5,000 characters.'
        : error.message;
    back('/contact', friendly);
  }
  redirect('/contact?sent=1');
}

export async function submitEnterpriseEnquiry(formData: FormData) {
  const company = String(formData.get('company') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const phone = String(formData.get('phone') ?? '').trim();
  const size = String(formData.get('team_size') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();
  if (!company || !name || !email) {
    back('/corporate', 'Please tell us your company, your name and your email.');
  }

  const supabase = await createClient();
  const { error } = await supabase.from('support_requests').insert({
    customer_id: null,
    requester_kind: 'visitor',
    organization_name: company,
    kind: 'enterprise_enquiry',
    subject: `Enterprise enquiry — ${company}`,
    body: [
      `Company: ${company}`,
      `Contact: ${name}`,
      `Email: ${email}`,
      phone ? `Phone: ${phone}` : null,
      size ? `Team size: ${size}` : null,
      '',
      message || 'No additional message.',
    ]
      .filter(Boolean)
      .join('\n'),
    reference: `ENQUIRY-${Date.now().toString(36).toUpperCase()}`,
    status: 'open',
  });
  if (error) back('/corporate', error.message);
  redirect('/corporate?sent=1');
}

export async function submitDeletionRequest(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const note = String(formData.get('note') ?? '').trim();
  if (!email || !email.includes('@')) {
    back('/account-deletion', 'Enter the email address on your Tazilla account.');
  }

  const supabase = await createClient();
  // A signed-out visitor cannot insert into support_requests directly: the
  // table's INSERT policy rejects a null customer_id. This RPC is the one
  // purpose-built public entry point, so the form works without a session.
  const { error } = await supabase.rpc('submit_account_deletion_request', {
    p_email: email,
    p_note: note || null,
  });
  if (error) back('/account-deletion', error.message);
  redirect('/account-deletion?sent=1');
}

export async function joinLaunchList(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) back('/download', 'Enter your email address.');

  const supabase = await createClient();
  const { error } = await supabase.from('support_requests').insert({
    customer_id: null,
    requester_kind: 'visitor',
    kind: 'launch_list',
    subject: 'App launch list',
    body: `Please tell me when the Tazilla app is available: ${email}`,
    reference: `LAUNCH-${Date.now().toString(36).toUpperCase()}`,
    status: 'open',
  });
  if (error) back('/download', error.message);
  redirect('/download?sent=1');
}
