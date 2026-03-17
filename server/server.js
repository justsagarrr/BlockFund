import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import { getDb } from './db.js';
import authRoutes from './routes/auth.js';
import campaignRoutes from './routes/campaigns.js';

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'blockfund_secret_key_2024';

// Middleware
app.use(cors());
app.use(express.json());

// Auth middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
}

function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ error: `This action requires ${role} role` });
    }
    next();
  };
}

// Middleware that optionally attaches user if token is present
function optionalAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
    } catch (err) {
      // Token invalid, continue without user
    }
  }
  next();
}

// Routes
app.use('/api/auth', authRoutes);

// Campaign routes: GET is public, POST requires auth
app.use('/api/campaigns', optionalAuth, campaignRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize DB and start server
async function start() {
  try {
    await getDb();
    console.log('Database initialized.');

    app.listen(PORT, () => {
      console.log(`BlockFund server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

start();

export { authenticateToken, requireRole };
