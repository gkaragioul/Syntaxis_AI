module.exports = {
  PDFDocument: {
    load: jest.fn(() => Promise.resolve({
      getPageCount: jest.fn(() => 1),
      getPage: jest.fn(() => ({
        getSize: jest.fn(() => ({ width: 100, height: 100 }))
      }))
    }))
  }
};
