/* eslint-disable no-console */
const { spawn } = require('child_process');
const path = require('path');

const { MongoMemoryServer } = require('mongodb-memory-server');

const PROJECT_ROOT = path.resolve(__dirname, '..');

const runSeed = (mongoUrl) =>
  new Promise((resolve, reject) => {
    const child = spawn('node', ['scripts/seedRoles.js'], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, MONGO_URL: mongoUrl },
      stdio: 'inherit'
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`seed exited with code ${code}`));
      }
    });
  });

const main = async () => {
  const mongod = await MongoMemoryServer.create();
  const mongoUrl = mongod.getUri();
  console.log(`In-memory MongoDB running at ${mongoUrl}`);

  await runSeed(mongoUrl);

  const serverProcess = spawn('node', ['src/server.js'], {
    cwd: PROJECT_ROOT,
    env: { ...process.env, MONGO_URL: mongoUrl },
    stdio: 'inherit'
  });

  const shutdown = async () => {
    serverProcess.kill('SIGTERM');
    await mongod.stop();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  serverProcess.on('close', async () => {
    await mongod.stop();
    process.exit(0);
  });
};

main().catch((error) => {
  console.error('Failed to start local dev server:', error);
  process.exit(1);
});
