import { Request, Response, NextFunction } from 'express';

// Generate unique request ID if not provided
const generateRequestId = (): string => {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

// Middleware to add standard response headers
export const responseHeadersMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Add API version header
  res.setHeader('X-API-Version', 'v1');
  
  // Add request ID header (generate if not provided)
  const requestId = req.headers['x-request-id'] as string || generateRequestId();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  // Add timestamp header
  res.setHeader('X-Response-Time', new Date().toISOString());
  
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  
  // Add cache control for API responses
  if (req.path.startsWith('/api/')) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  
  next();
};

// Middleware to ensure JSON content type for API responses
export const jsonContentTypeMiddleware = (req: Request, res: Response, next: NextFunction) => {
  // Override res.json to ensure proper content type
  const originalJson = res.json;
  
  res.json = function(obj: any) {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return originalJson.call(this, obj);
  };
  
  next();
};

// Middleware to handle CORS preflight requests
export const corsPreflightMiddleware = (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    return res.status(204).end();
  }
  
  next();
};

// Middleware to add response timing
export const responseTimingMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const startTime = Date.now();
  
  // Override res.end to calculate response time
  const originalEnd = res.end;
  
  res.end = function(chunk?: any, encoding?: any) {
    const responseTime = Date.now() - startTime;
    res.setHeader('X-Response-Time-Ms', responseTime.toString());
    
    return originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

// Combined middleware for all response enhancements
export const enhancedResponseMiddleware = [
  corsPreflightMiddleware,
  responseHeadersMiddleware,
  jsonContentTypeMiddleware,
  responseTimingMiddleware,
];

export default enhancedResponseMiddleware;
