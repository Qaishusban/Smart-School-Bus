import { supabase } from '../lib/supabase';

export async function listSupportTickets(schoolId: string) {
  const { data, error } = await supabase
    .from('support_tickets')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

export async function createSupportTicket(params: {
  schoolId: string;
  createdBy: string;
  subject: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
}) {
  const { data, error } = await supabase
    .from('support_tickets')
    .insert({
      school_id: params.schoolId,
      created_by: params.createdBy,
      subject: params.subject.trim(),
      description: params.description.trim(),
      priority: params.priority,
      category: params.category,
      status: 'open',
    })
    .select('*')
    .limit(1);

  if (error) throw error;
  return (data ?? [])[0] ?? null;
}

export async function listSupportMessages(ticketId: string) {
  const { data, error } = await supabase
    .from('support_ticket_messages')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data ?? [];
}

export async function addSupportMessage(params: {
  ticketId: string;
  senderId: string;
  senderRole: string;
  message: string;
}) {
  const { data, error } = await supabase
    .from('support_ticket_messages')
    .insert({
      ticket_id: params.ticketId,
      sender_id: params.senderId,
      sender_role: params.senderRole,
      message: params.message.trim(),
    })
    .select('*')
    .limit(1);

  if (error) throw error;

  await supabase
    .from('support_tickets')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', params.ticketId);

  return (data ?? [])[0] ?? null;
}
