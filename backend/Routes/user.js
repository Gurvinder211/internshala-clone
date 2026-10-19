import { Router } from 'express';
const router = Router();
import protect from '../middleware/auth.js';
import User from '../Model/User.js';
import { normalizePhone } from '../Services/phone.js';

router.patch('/phone', protect, async (req, res) => {
  try {
    const phone = normalizePhone(req.body.phone);
    if (!phone) return res.status(400).json({ error: 'Enter a valid mobile number, e.g. +91 98765 43210' });
    if (await User.exists({ phone, _id: { $ne: req.user._id } })) {
      return res.status(409).json({ error: 'That mobile number is already linked to another account' });
    }
    req.user.phone = phone;
    await req.user.save();
    res.json({ success: true, phone });
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ error: 'That mobile number is already linked to another account' });
    console.error('phone update failed:', err);
    res.status(500).json({ error: 'Could not save mobile number' });
  }
});

// POST /api/user/sync
// Frontend calls this right after Firebase login
router.post('/sync', protect, async (req, res) => {
  try {
    // The protect middleware has already validated the token 
    // and fetched/created the user in req.user
    
    res.status(200).json({
      success: true,
      message: 'User synced successfully.',
      user: {
    id: req.user._id,
    name: req.user.name,
    email: req.user.email,
    photo: req.user.photo,
    language: req.user.language,
    isPremium: req.user.isPremium,
    subscription: req.user.subscription,
    friendCount: req.user.friendCount,
    mustChangePassword: req.user.mustChangePassword,

      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error syncing user.' });
  }
});

export default router;
