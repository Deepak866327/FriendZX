const http = require('http');

function req(method, host, port, path, body, headers = {}) {
  return new Promise((res) => {
    const data = body ? JSON.stringify(body) : null;
    const r = http.request({
      hostname: host, port, path, method,
      headers: { 'Content-Type': 'application/json', 'Content-Length': data ? Buffer.byteLength(data) : 0, ...headers }
    }, resp => {
      let d = '';
      resp.on('data', c => d += c);
      resp.on('end', () => { try { res({ s: resp.statusCode, b: JSON.parse(d) }); } catch { res({ s: resp.statusCode, b: d }); } });
    });
    r.on('error', e => res({ s: 0, b: { error: e.message } }));
    if (data) r.write(data);
    r.end();
  });
}

const UID = 'b338ffa0-ffe1-4289-bb6e-fd81ac017527';
const A = { 'x-user-id': UID };
let pass = 0, fail = 0;

function check(name, s, ok, extra) {
  const sym = ok ? '✓' : '✗';
  console.log(sym, name + ':', s, extra !== undefined ? String(extra) : '');
  if (ok) pass++; else fail++;
}

(async () => {
  let r;

  // ── API GATEWAY ───────────────────────────────────────────────
  r = await req('GET', 'localhost', 3000, '/health', null, {});
  check('api-gateway/health', r.s, r.s === 200 && r.b.status);

  // ── AUTH SERVICE ──────────────────────────────────────────────
  r = await req('GET', 'auth-service', 3001, '/health', null, {});
  check('auth/health', r.s, r.s === 200);
  r = await req('POST', 'auth-service', 3001, '/send-otp', { email: 'checktest@example.com' }, {});
  check('auth/send-otp', r.s, r.s === 200 || r.s === 409, r.b.error || r.b.message || '');
  r = await req('GET', 'auth-service', 3001, '/username/check/testuser123', null, {});
  check('auth/username-check', r.s, r.s === 200 && r.b.available !== undefined);
  r = await req('POST', 'auth-service', 3001, '/login', { email: 'sysaudit_1780337272765@test.com', password: 'Test1234!' }, {});
  check('auth/login', r.s, r.s === 200 && r.b.token, r.b.error || '');

  // ── USER SERVICE ──────────────────────────────────────────────
  r = await req('GET', 'user-service', 3002, '/health', null, {});
  check('user/health', r.s, r.s === 200);
  r = await req('GET', 'user-service', 3002, '/profile', null, A);
  check('user/get-profile', r.s, r.s === 200 && r.b.id);
  r = await req('PUT', 'user-service', 3002, '/profile', { bio: 'Audit bot' }, A);
  check('user/update-profile', r.s, r.s === 200);
  r = await req('GET', 'user-service', 3002, '/search?q=sys', null, A);
  check('user/search', r.s, r.s === 200 && Array.isArray(r.b));
  r = await req('GET', 'user-service', 3002, '/following/' + UID, null, {});
  check('user/following/:id (internal)', r.s, r.s === 200 && Array.isArray(r.b.following), r.b.error || '');
  r = await req('GET', 'user-service', 3002, '/followers/' + UID, null, {});
  check('user/followers/:id (internal)', r.s, r.s === 200 && Array.isArray(r.b.followers), r.b.error || '');
  r = await req('GET', 'user-service', 3002, '/relationship/' + UID, null, A);
  check('user/relationship', r.s, r.s === 200 && r.b.isFollowing !== undefined);

  // ── LOCATION SERVICE ──────────────────────────────────────────
  r = await req('GET', 'location-service', 3003, '/health', null, {});
  check('location/health', r.s, r.s === 200);
  r = await req('POST', 'location-service', 3003, '/update', { latitude: 22.32, longitude: 87.30, accuracy: 10 }, A);
  check('location/update', r.s, r.s === 200 || r.s === 201, r.b.error || '');
  r = await req('GET', 'location-service', 3003, '/nearby?latitude=22.32&longitude=87.30&radius=50000', null, A);
  check('location/nearby', r.s, r.s === 200 && (r.b.nearby !== undefined || Array.isArray(r.b)));
  r = await req('GET', 'location-service', 3003, '/current', null, A);
  check('location/current', r.s, r.s === 200 || r.s === 404, r.b.error || '');
  r = await req('GET', 'location-service', 3003, '/bt/health', null, {});
  check('location/bt-health', r.s, r.s === 200);

  // ── NOTIFICATION SERVICE ──────────────────────────────────────
  r = await req('GET', 'notification-service', 3004, '/health', null, {});
  check('notification/health', r.s, r.s === 200);
  r = await req('GET', 'notification-service', 3004, '/', null, A);
  check('notification/list', r.s, r.s === 200 && (Array.isArray(r.b) || r.b.notifications !== undefined));
  r = await req('GET', 'notification-service', 3004, '/unread/count', null, A);
  check('notification/unread-count', r.s, r.s === 200 && r.b.count !== undefined);
  r = await req('POST', 'notification-service', 3004, '/read/all', null, A);
  check('notification/mark-all-read', r.s, r.s === 200);

  // ── POST SERVICE ──────────────────────────────────────────────
  r = await req('GET', 'post-service', 3006, '/health', null, {});
  check('post/health', r.s, r.s === 200 && r.b.status, r.b.error || '');
  r = await req('GET', 'post-service', 3006, '/feed', null, A);
  check('post/public-feed', r.s, r.s === 200 && r.b.posts !== undefined);
  r = await req('GET', 'post-service', 3006, '/feed/friends', null, A);
  check('post/friends-feed', r.s, r.s === 200 && r.b.posts !== undefined);
  r = await req('GET', 'post-service', 3006, '/feed/nearby?latitude=22.32&longitude=87.30', null, A);
  check('post/nearby-feed', r.s, r.s === 200 && r.b.posts !== undefined);
  r = await req('GET', 'post-service', 3006, '/reels', null, A);
  check('post/reels-feed', r.s, r.s === 200 && r.b.posts !== undefined);

  // Text-only post
  r = await req('POST', 'post-service', 3006, '/', { caption: 'Audit text ' + Date.now(), visibility: 'PUBLIC', mediaIds: [] }, A);
  check('post/create-text', r.s, r.s === 201 && r.b.id, r.b.error || '');
  const postId = r.b.id;

  if (postId) {
    r = await req('GET', 'post-service', 3006, '/' + postId, null, A);
    check('post/get-by-id', r.s, r.s === 200 && r.b.id === postId);
    r = await req('POST', 'post-service', 3006, '/' + postId + '/like', null, A);
    check('post/like', r.s, r.s === 200);
    r = await req('DELETE', 'post-service', 3006, '/' + postId + '/like', null, A);
    check('post/unlike', r.s, r.s === 200);
    r = await req('DELETE', 'post-service', 3006, '/' + postId, null, A);
    check('post/delete', r.s, r.s === 200);
  }

  r = await req('GET', 'post-service', 3006, '/user/' + UID, null, A);
  check('post/user-posts', r.s, r.s === 200 && r.b.posts !== undefined);

  // ── MEDIA ─────────────────────────────────────────────────────
  r = await req('POST', 'post-service', 3006, '/media/presigned-url', { mimeType: 'image/jpeg', fileSize: 100000, fileName: 'test.jpg' }, A);
  check('media/presigned-url', r.s, r.s === 200 && r.b.config && r.b.config.uploadUrl, r.b.error || '');
  r = await req('GET', 'post-service', 3006, '/media/' + r.b.media?.id, null, A);
  check('media/get-by-id', r.s, r.s === 200 || r.s === 404, r.b.error || '');

  // ── CRATIONS ──────────────────────────────────────────────────
  r = await req('GET', 'post-service', 3006, '/crations/feed', null, A);
  check('crations/public-feed', r.s, r.s === 200 && r.b.crations !== undefined);
  r = await req('GET', 'post-service', 3006, '/crations/feed/public', null, A);
  check('crations/feed-public', r.s, r.s === 200 && r.b.crations !== undefined);
  r = await req('GET', 'post-service', 3006, '/crations/feed/nearby?latitude=22.32&longitude=87.30&radius=50', null, A);
  check('crations/nearby', r.s, r.s === 200 && r.b.crations !== undefined);

  // ── COMMUNITIES ───────────────────────────────────────────────
  r = await req('GET', 'post-service', 3006, '/communities/nearby?latitude=22.32&longitude=87.30', null, A);
  check('communities/nearby', r.s, r.s === 200 && Array.isArray(r.b), r.b.error || '');
  r = await req('GET', 'post-service', 3006, '/communities/my', null, A);
  check('communities/my (alias)', r.s, r.s === 200 && Array.isArray(r.b), r.b.error || '');
  r = await req('GET', 'post-service', 3006, '/communities/mine', null, A);
  check('communities/mine', r.s, r.s === 200 && Array.isArray(r.b));
  r = await req('GET', 'post-service', 3006, '/communities/discover?latitude=22.32&longitude=87.30', null, A);
  check('communities/discover', r.s, r.s === 200 && Array.isArray(r.b));

  // ── STORIES ───────────────────────────────────────────────────
  r = await req('GET', 'post-service', 3006, '/stories/feed?latitude=22.32&longitude=87.30', null, A);
  check('stories/feed', r.s, r.s === 200 && r.b.groups !== undefined);
  r = await req('GET', 'post-service', 3006, '/stories/user/' + UID, null, A);
  check('stories/user', r.s, r.s === 200 && r.b.stories !== undefined);

  // ── CHALLENGE SERVICE ─────────────────────────────────────────
  r = await req('GET', 'challenge-service', 3008, '/health', null, {});
  check('challenge/health', r.s, r.s === 200);
  r = await req('GET', 'challenge-service', 3008, '/daily', null, A);
  check('challenge/daily', r.s, r.s === 200 && r.b.questions !== undefined, r.b.error || '');
  r = await req('GET', 'challenge-service', 3008, '/daily/streak', null, A);
  check('challenge/streak', r.s, r.s === 200 && r.b.current !== undefined, r.b.error || '');
  r = await req('GET', 'challenge-service', 3008, '/friend/pending', null, A);
  check('challenge/friend-pending', r.s, r.s === 200 && Array.isArray(r.b));
  r = await req('GET', 'challenge-service', 3008, '/challenge-types', null, {});
  check('challenge/types', r.s, r.s === 200 && Array.isArray(r.b));

  // ── RANDOM CONNECT ────────────────────────────────────────────
  r = await req('GET', 'random-connect-service', 3007, '/health', null, {});
  check('randconn/health', r.s, r.s === 200);
  r = await req('POST', 'random-connect-service', 3007, '/rooms', { latitude: 22.32, longitude: 87.30, title: 'Test Room', creatorName: 'Audit' }, A);
  check('randconn/create-room', r.s, r.s === 201 && r.b.id, r.b.error || '');
  const roomId = r.b.id;
  if (roomId) {
    r = await req('GET', 'random-connect-service', 3007, '/rooms/nearby?latitude=22.32&longitude=87.30&radius=100', null, A);
    check('randconn/nearby-rooms', r.s, r.s === 200 && Array.isArray(r.b));
    r = await req('POST', 'random-connect-service', 3007, '/rooms/' + roomId + '/join', { displayName: 'Audit' }, A);
    check('randconn/join-room', r.s, r.s === 200 && r.b.id);
    r = await req('DELETE', 'random-connect-service', 3007, '/rooms/' + roomId, null, A);
    check('randconn/delete-room', r.s, r.s === 200);
  }

  console.log('\n═══════════════════════════════════════');
  console.log('RESULTS:', pass, 'passed,', fail, 'failed out of', pass + fail, 'tests');
  console.log('═══════════════════════════════════════');
})().catch(e => console.error('FATAL:', e.message));
