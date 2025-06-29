export const mockAuthMiddleware = jest.fn((_req, _res, next) => next());
export const mockRateLimiter = jest.fn((_req, _res, next) => next());

export default {
  mockAuthMiddleware,
  mockRateLimiter,
};
