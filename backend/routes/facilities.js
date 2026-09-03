import { Router } from 'express';
import { supabase } from '../lib/supabaseClient.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

router.get('/', authenticate, async (req, res) => {
  const { data, error } = await supabase.from('facilities').select('*');

  if (error) {
    console.error('Facilities list error:', error.message);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }

  return res.json(data);
});

export default router;
