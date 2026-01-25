module.exports = {
  getDocument: jest.fn(() => ({
    promise: Promise.resolve({
      numPages: 1,
      getPage: jest.fn(() => Promise.resolve({
        getViewport: () => ({ width: 600, height: 800 }),
        getTextContent: () => Promise.resolve({ items: [] })
      }))
    })
  })),
  GlobalWorkerOptions: {
    workerSrc: ''
  }
};
