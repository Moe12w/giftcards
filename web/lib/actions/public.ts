'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

function back(path: string, message: string): never {
  redirect(`${path}${path.includes('?') ? '&' : '?'}error=${encodeURIComponent(message)}`);
}

export async function submitContact(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '').trim();
  const subject = String(formData.get('subject') ?? '').trim();
  const message = String(formData.get('message') ?? '').trim();
  if (!name || !email || !message) {
    back('/contact', 'Please fill in your name, email and message.');
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from('support_requests').insert({
    customer_id: user?.id ?? null,
    kind: 'contact',
    subject: subject || `Website contact from ${name}`,
    body: `From: ${name} <${email}>\n\n${message}`,
    reference: email,
    status: 'open',
  });
  if (error) back('/contact', error.message);
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
    back('/enterprise', 'Please tell us your company, your name and your email.');
  }

  const supabase = await createClient();
  const { error } = await supabase.from('support_requests').insert({
    customer_id: null,
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
    reference: email,
    status: 'open',
  });
  if (error) back('/enterprise', error.message);
  redirect('/enterprise?sent=1');
}

export async function joinLaunchList(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  if (!email) back('/download', 'Enter your email address.');

  const supabase = await createClient();
  const { error } = await supabase.from('support_requests').insert({
    customer_id: null,
    kind: 'launch_list',
    subject: 'App launch list',
    body: `Please tell me when the Giftly app is available: ${email}`,
    reference: email,
    status: 'open',
  });
  if (error) back('/download', error.message);
  redirect('/download?sent=1');
}
