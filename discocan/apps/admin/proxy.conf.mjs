import process from 'node:process';

const port = process.env.ROUTER_PORT ?? '11010';
if (!/^[0-9]+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
  throw new Error('ROUTER_PORT must be an integer between 1 and 65535.');
}

export default {
  '/graphql': {
    target: `http://127.0.0.1:${port}`,
    changeOrigin: true,
  },
};
