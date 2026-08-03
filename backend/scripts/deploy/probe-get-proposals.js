const http = require('http');

(async () => {
  const data = JSON.stringify({ dleAddress: '0xB55060a59D7c1135984CAA273ED9bd453A651350' });
  const t0 = Date.now();
  const result = await new Promise((resolve, reject) => {
    const r = http.request(
      {
        hostname: '127.0.0.1',
        port: 8000,
        path: '/api/dle-proposals/get-proposals',
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) },
        timeout: 60000,
      },
      (res) => {
        let b = '';
        res.on('data', (d) => (b += d));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(b);
          } catch (_) {}
          resolve({
            status: res.statusCode,
            ms: Date.now() - t0,
            success: parsed && parsed.success,
            count: parsed && parsed.data && parsed.data.proposals ? parsed.data.proposals.length : null,
            byChain: (parsed && parsed.data && parsed.data.proposals ? parsed.data.proposals : []).reduce(
              (acc, p) => {
                acc[p.chainId] = (acc[p.chainId] || 0) + 1;
                return acc;
              },
              {}
            ),
            sample: (parsed && parsed.data && parsed.data.proposals ? parsed.data.proposals : [])
              .slice(0, 5)
              .map((p) => ({ id: p.id, chainId: p.chainId, state: p.state, desc: p.description })),
            error: parsed && parsed.error,
            head: b.slice(0, 300),
          });
        });
      }
    );
    r.on('error', reject);
    r.on('timeout', () => {
      r.destroy();
      reject(new Error('timeout'));
    });
    r.write(data);
    r.end();
  });
  console.log(JSON.stringify(result, null, 2));
})().catch((e) => {
  console.error('ERR', e.message);
  process.exit(1);
});
