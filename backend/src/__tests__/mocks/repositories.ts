export const mockUserRepository = {
  findById: jest.fn(),
  findByEmail: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

export const mockFileRepository = {
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

export const mockInvoiceRepository = {
  findById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};

export default {
  mockUserRepository,
  mockFileRepository,
  mockInvoiceRepository,
};
