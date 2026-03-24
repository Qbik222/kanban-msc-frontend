/**
 * Browser navigation to /boards (and other REST paths used as SPA routes) would otherwise
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
    path.startsWith('/columns') ||
    path.startsWith('/cards')
  ) {
    return '/index.html';
  }
  return undefined;
}

module.exports = [
  {
    context: ['/auth', '/users', '/boards', '/columns', '/cards', '/health', '/api'],
    target: 'http://localhost:3500',
    secure: false,
    changeOrigin: true,
    logLevel: 'silent',
    bypass: spaHtmlBypass,
  },
  {
    context: '/socket.io',
    target: 'http://localhost:3500',
    secure: false,
    ws: true,
    changeOrigin: true,
  },
];
