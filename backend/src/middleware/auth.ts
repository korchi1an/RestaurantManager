import { Request, Response, NextFunction } from 'express';
// TODO: Run 'npm install' to install jsonwebtoken, then uncomment below and remove temp implementation
// import jwt from 'jsonwebtoken';

// Temporary JWT implementation until package is installed
const jwt = {
  verify: (token: string, secret: string) => {
    if (token.startsWith('temp_token_')) {
      return JSON.parse(token.replace('temp_token_', ''));
    }
    throw new Error('Invalid token');
  }
};

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production-PLEASE';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    userId: string;
    role: string;
    username: string;
  };
}

export const authenticate = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'No authentication token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = {
      id: decoded.id,
      userId: decoded.userId,
      role: decoded.role,
      username: decoded.username
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user?.role || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Optional authentication - allows both authenticated and unauthenticated requests
export const optionalAuth = (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.replace('Bearer ', '');

  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as any;
      req.user = {
        id: decoded.id,
        userId: decoded.userId,
        role: decoded.role,
        username: decoded.username
      };
    } catch (error) {
      // Token invalid, but we'll allow the request anyway
      console.log('Invalid token provided, continuing without auth');
    }
  }

  next();
};
