import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  const { data, error } = await supabase
    .from('follow_ups')
    .select('*, referral:referrals(patient:patients(name), facility:facilities(name))')
    .eq('assigned_to', req.worker.id);

  if (error) {
    console.error('Follow-ups list error:', error.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  const followUps = data
    .map(({ referral, ...rest }) => ({
      ...rest,
      patient_name: referral?.patient?.name || null,
      facility_name: referral?.facility?.name || null,
    }))
    .sort((a, b) => {
      if (a.status !== b.status) {
        return a.status === 'PENDING' ? -1 : 1;
      }
      return new Date(a.due_date) - new Date(b.due_date);
    });

  return res.json(followUps);
});

router.patch('/:id/complete', authenticate, async (req, res) => {
  const { notes } = req.body || {};
  const { id } = req.params;

  const { data: followUp, error: fetchError } = await supabase
    .from('follow_ups')
    .select('id, assigned_to')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) {
    console.error('Follow-up fetch error:', fetchError.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
  if (!followUp) {
    return res.status(404).json({ error: 'Follow-up not found.' });
  }
  if (followUp.assigned_to !== req.worker.id) {
    return res.status(403).json({ error: 'You are not allowed to update this follow-up.' });
  }

  const { data: updated, error: updateError } = await supabase
    .from('follow_ups')
    .update({
      status: 'COMPLETED',
      completed_at: new Date().toISOString(),
      notes: typeof notes === 'string' && notes.trim() ? notes.trim() : null,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (updateError) {
    console.error('Follow-up update error:', updateError.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  return res.json(updated);
});

export default router;
