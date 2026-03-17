import express from 'express';
import { getDb, saveDb } from '../db.js';

const router = express.Router();

// GET /api/campaigns — all campaigns
router.get('/', async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec("SELECT * FROM campaigns ORDER BY id DESC");

    if (result.length === 0) {
      return res.json([]);
    }

    const columns = result[0].columns;
    const campaigns = result[0].values.map(row => {
      const obj = {};
      columns.forEach((col, i) => { obj[col] = row[i]; });
      return obj;
    });

    res.json(campaigns);
  } catch (error) {
    console.error('Get campaigns error:', error);
    res.status(500).json({ error: 'Failed to fetch campaigns' });
  }
});

// GET /api/campaigns/:id — single campaign
router.get('/:id', async (req, res) => {
  try {
    const db = await getDb();
    const result = db.exec("SELECT * FROM campaigns WHERE id = ?", [req.params.id]);

    if (result.length === 0 || result[0].values.length === 0) {
      return res.status(404).json({ error: 'Campaign not found' });
    }

    const columns = result[0].columns;
    const row = result[0].values[0];
    const campaign = {};
    columns.forEach((col, i) => { campaign[col] = row[i]; });

    res.json(campaign);
  } catch (error) {
    console.error('Get campaign error:', error);
    res.status(500).json({ error: 'Failed to fetch campaign' });
  }
});

// POST /api/campaigns — create (protected, campaigner only)
router.post('/', async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (req.user.role !== 'campaigner') {
      return res.status(403).json({ error: 'Only campaigners can create campaigns' });
    }

    const { campaign_address, creator_address, title, description, image_url, category, goal_amount, duration_days } = req.body;

    if (!campaign_address || !creator_address || !title) {
      return res.status(400).json({ error: 'campaign_address, creator_address, and title are required' });
    }

    const db = await getDb();
    db.run(
      `INSERT INTO campaigns (campaign_address, creator_address, title, description, image_url, category, goal_amount, duration_days)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [campaign_address, creator_address, title, description || '', image_url || '', category || '', goal_amount || '0', duration_days || 30]
    );
    saveDb();

    const result = db.exec("SELECT * FROM campaigns WHERE campaign_address = ?", [campaign_address]);
    const columns = result[0].columns;
    const row = result[0].values[0];
    const campaign = {};
    columns.forEach((col, i) => { campaign[col] = row[i]; });

    res.status(201).json(campaign);
  } catch (error) {
    console.error('Create campaign error:', error);
    res.status(500).json({ error: 'Failed to create campaign' });
  }
});

export default router;
