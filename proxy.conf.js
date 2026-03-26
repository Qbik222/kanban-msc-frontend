/**
 * Browser navigation to /boards, /teams, etc. (REST paths that overlap SPA routes) would otherwise
 * be proxied to the API and return JSON 401. Serve index.html for document requests instead.
 */
function spaHtmlBypass(req) {
  const accept = req.headers.accept ?? '';
  if (!accept.includes('text/html')) {
    return undefined;
  }
  const path = (req.url ?? '').split('?')[0];
  if (
    path.startsWith('/boards') ||
    path.startsWith('/teams') ||
    path.startsWith('/columns') ||
    path.startsWith('/cards')
  ) {
    return '/index.html';
  }
  return undefined;
}

const apiTarget = 'http://localhost:3500';

const apiProxy = {
  target: apiTarget,
  secure: false,
  changeOrigin: true,
  logLevel: 'silent',
  bypass: spaHtmlBypass,
};

module.exports = {
  '/auth': apiProxy,
  '/users': apiProxy,
  '/teams': apiProxy,
  '/boards': apiProxy,
  '/columns': apiProxy,
  '/cards': apiProxy,
  '/health': apiProxy,
  '/api': apiProxy,
  '/socket.io': {
    target: apiTarget,
    secure: false,
    ws: true,
    changeOrigin: true,
  },
};
