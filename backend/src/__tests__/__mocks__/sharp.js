const mockSharpInstance = {
  grayscale: jest.fn().mockReturnThis(),
  modulate: jest.fn().mockReturnThis(),
  threshold: jest.fn().mockReturnThis(),
  median: jest.fn().mockReturnThis(),
  toBuffer: jest.fn(() => Promise.resolve(Buffer.from('processed image'))),
  metadata: jest.fn(() => Promise.resolve({ width: 100, height: 100, format: 'jpeg' })),
};

const mockSharp = jest.fn(() => mockSharpInstance);

// Add the instance methods to the mock function itself for chaining
Object.assign(mockSharp, mockSharpInstance);

module.exports = mockSharp;
