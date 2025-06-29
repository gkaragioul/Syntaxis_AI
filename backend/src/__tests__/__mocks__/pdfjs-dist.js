module.exports = {
  getDocument: jest.fn(() => ({
    promise: Promise.resolve({
      getPage: jest.fn(() => Promise.resolve({
        getViewport: jest.fn(() => ({ scale: 1, width: 100, height: 100 })),
        render: jest.fn(() => ({ promise: Promise.resolve() }))
      }))
    })
  }))
};
