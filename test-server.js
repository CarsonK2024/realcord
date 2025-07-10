const { spawn } = require('child_process');
const path = require('path');

console.log('Testing server startup...');

const serverPath = path.join(__dirname, 'server', 'index.js');
const serverCwd = path.join(__dirname, 'server');

console.log('Server path:', serverPath);
console.log('Working directory:', serverCwd);

// Check if files exist
const fs = require('fs');
if (!fs.existsSync(serverPath)) {
  console.error('Server file not found!');
  process.exit(1);
}

if (!fs.existsSync(serverCwd)) {
  console.error('Server directory not found!');
  process.exit(1);
}

// Try to start the server
const serverProcess = spawn('node', [serverPath], {
  stdio: 'pipe',
  cwd: serverCwd,
  env: { ...process.env, NODE_ENV: 'production' }
});

serverProcess.stdout.on('data', (data) => {
  console.log('Server stdout:', data.toString());
});

serverProcess.stderr.on('data', (data) => {
  console.log('Server stderr:', data.toString());
});

serverProcess.on('error', (error) => {
  console.error('Server process error:', error);
});

serverProcess.on('close', (code) => {
  console.log(`Server process exited with code ${code}`);
  process.exit(code);
});

// Stop after 10 seconds
setTimeout(() => {
  console.log('Stopping test...');
  serverProcess.kill();
  process.exit(0);
}, 10000); 