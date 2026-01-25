from fastapi import Request
from fastapi.responses import JSONResponse
from datetime import datetime, timedelta
from collections import defaultdict
import time

class RateLimiter:
    def __init__(self):
        self.requests = defaultdict(list)
    
    def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> bool:
        now = time.time()
        window_start = now - window_seconds
        
        self.requests[key] = [
            req_time for req_time in self.requests[key]
            if req_time > window_start
        ]
        
        if len(self.requests[key]) >= max_requests:
            return False
        
        self.requests[key].append(now)
        return True

rate_limiter = RateLimiter()

async def rate_limit_middleware(request: Request, call_next):
    # Skip rate limiting for CORS preflight requests
    if request.method == "OPTIONS":
        response = await call_next(request)
        return response

    client_ip = request.client.host
    path = request.url.path

    # More generous limits for development
    limits = {
        "/documents/upload": (100, 60),
        "/batch": (100, 60),
        "/preview": (100, 60),
    }

    for route, (max_req, window) in limits.items():
        if path.startswith(route):
            key = f"{client_ip}:{route}"

            if not rate_limiter.is_allowed(key, max_req, window):
                return JSONResponse(
                    status_code=429,
                    content={
                        "detail": f"Rate limit exceeded. Max {max_req} requests per {window} seconds."
                    }
                )

    response = await call_next(request)
    return response
