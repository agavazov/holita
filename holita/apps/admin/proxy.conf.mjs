export default {
  '/graphql': { target: 'http://127.0.0.1:12010', secure: false },
  '/documents/invoices/**': { target: 'http://127.0.0.1:12013', secure: false },
  '/media/**': { target: 'http://127.0.0.1:12013', secure: false },
};
