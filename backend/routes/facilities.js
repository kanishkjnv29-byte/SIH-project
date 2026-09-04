import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

const router = Router();

router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { data, error } = await supabase.from('facilities').select('*');

  if (error) {
    console.error('Facilities list error:', error.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  return res.json(data);
}));

router.get('/:id/medicines', authenticate, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('facility_medicines')
    .select('*')
    .eq('facility_id', req.params.id)
    .order('medicine_name', { ascending: true });

  if (error) {
    console.error('Facility medicines list error:', error.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  return res.json(data);
}));

router.get('/:id/staff', authenticate, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('facility_staff')
    .select('*')
    .eq('facility_id', req.params.id)
    .order('specialty', { ascending: true });

  if (error) {
    console.error('Facility staff list error:', error.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  return res.json(data);
}));

router.get('/:id/equipment', authenticate, asyncHandler(async (req, res) => {
  const { data, error } = await supabase
    .from('facility_equipment')
    .select('*')
    .eq('facility_id', req.params.id)
    .order('equipment_name', { ascending: true });

  if (error) {
    console.error('Facility equipment list error:', error.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  return res.json(data);
}));

export default router;
