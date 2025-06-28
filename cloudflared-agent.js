const express = require('express');
const { exec } = require('child_process');
const app = express();
app.use(express.json());

app.post('/cloudflared/restart', (req, res) => {
  exec('docker-compose up -d cloudflared', (err, stdout, stderr) => {
    if (err) {
      return res.status(500).json({ success: false, message: stderr || err.message });
    }
    res.json({ success: true, message: 'cloudflared перезапущен', output: stdout });
  });
});

app.listen(9000, '0.0.0.0', () => {
  console.log('Cloudflared agent listening on 0.0.0.0:9000');
}); 