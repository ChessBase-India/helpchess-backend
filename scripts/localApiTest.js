/* eslint-disable no-console */
const { spawn } = require('child_process');
const path = require('path');

const { MongoMemoryServer } = require('mongodb-memory-server');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const PORT = 3000;
const BASE_URL = `http://localhost:${PORT}`;

const run = (command, args, env = {}) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: PROJECT_ROOT,
      env: { ...process.env, ...env },
      stdio: 'inherit'
    });
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
      }
    });
  });

const waitForServer = async (maxAttempts = 30) => {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(`${BASE_URL}/healthz`);
      if (response.ok) {
        return;
      }
    } catch (e) {
      // retry
    }
    await new Promise((resolve) => {
      setTimeout(resolve, 500);
    });
  }
  throw new Error('Server did not become ready in time');
};

const request = async ({ method, path: requestPath, body, cookieFile }) => {
  const args = ['-s', '-w', '\n%{http_code}', '-X', method, `${BASE_URL}${requestPath}`];
  if (cookieFile) {
    args.unshift('-b', cookieFile, '-c', cookieFile);
  }
  if (body) {
    args.push('-H', 'Content-Type: application/json', '-d', JSON.stringify(body));
  }

  const result = await new Promise((resolve, reject) => {
    let stdout = '';
    const child = spawn('curl', args, { cwd: PROJECT_ROOT });
    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`curl failed for ${method} ${requestPath}`));
        return;
      }
      const lines = stdout.trim().split('\n');
      const statusCode = lines.pop();
      const responseBody = lines.join('\n');
      resolve({ statusCode: Number(statusCode), body: responseBody ? JSON.parse(responseBody) : null });
    });
  });

  return result;
};

const main = async () => {
  const cookieFile = path.join(PROJECT_ROOT, '.test-cookies.txt');
  let mongod;
  let serverProcess;

  try {
    console.log('Starting in-memory MongoDB...');
    mongod = await MongoMemoryServer.create();
    const mongoUrl = mongod.getUri();
    const sharedEnv = { MONGO_URL: mongoUrl };

    console.log('Seeding roles and admin user...');
    await run('node', ['scripts/seedRoles.js'], sharedEnv);

    console.log('Starting server...');
    serverProcess = spawn('node', ['src/server.js'], {
      cwd: PROJECT_ROOT,
      env: { ...process.env, ...sharedEnv },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    serverProcess.stdout.on('data', (chunk) => process.stdout.write(chunk));
    serverProcess.stderr.on('data', (chunk) => process.stderr.write(chunk));

    await waitForServer();
    console.log('Server is ready.\n');

    console.log('1. POST /v1/login');
    const login = await request({
      method: 'POST',
      path: '/v1/login',
      body: { email: 'admin@example.com', password: 'adminpassword123' },
      cookieFile
    });
    console.log(`   Status: ${login.statusCode}`);
    console.log(`   ok: ${login.body.ok}, email: ${login.body.data?.email}`);

    console.log('\n2. GET /v1/me');
    const me = await request({ method: 'GET', path: '/v1/me', cookieFile });
    console.log(`   Status: ${me.statusCode}`);
    console.log(`   ok: ${me.body.ok}, fullName: ${me.body.data?.fullName}`);

    console.log('\n3. POST /v1/refresh');
    const refresh = await request({ method: 'POST', path: '/v1/refresh', cookieFile });
    console.log(`   Status: ${refresh.statusCode}`);
    console.log(`   ok: ${refresh.body.ok}, userId: ${refresh.body.data?.userId}`);

    console.log('\n4. GET /v1/users');
    const users = await request({ method: 'GET', path: '/v1/users', cookieFile });
    console.log(`   Status: ${users.statusCode}`);
    console.log(`   ok: ${users.body.ok}, total: ${users.body.data?.total}`);

    console.log('\n5. POST /v1/users');
    const adminRoleId = me.body.data?.roleId?._id;
    const createUser = await request({
      method: 'POST',
      path: '/v1/users',
      cookieFile,
      body: {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        password: 'janepassword123',
        roleId: adminRoleId,
        status: 'active'
      }
    });
    console.log(`   Status: ${createUser.statusCode}`);
    console.log(`   ok: ${createUser.body.ok}, email: ${createUser.body.data?.email}`);

    console.log('\n6. PATCH /v1/users/:id');
    const userId = createUser.body.data?._id;
    const patchUser = await request({
      method: 'PATCH',
      path: `/v1/users/${userId}`,
      cookieFile,
      body: { firstName: 'Janet' }
    });
    console.log(`   Status: ${patchUser.statusCode}`);
    console.log(`   ok: ${patchUser.body.ok}, fullName: ${patchUser.body.data?.fullName}`);

    const allPassed =
      login.statusCode === 200 &&
      login.body.ok &&
      me.statusCode === 200 &&
      me.body.ok &&
      refresh.statusCode === 200 &&
      refresh.body.ok &&
      users.statusCode === 200 &&
      users.body.ok &&
      createUser.statusCode === 200 &&
      createUser.body.ok &&
      patchUser.statusCode === 200 &&
      patchUser.body.ok;

    console.log(allPassed ? '\nAll local API tests passed.' : '\nSome tests failed.');
    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    console.error('\nLocal test run failed:', error.message);
    process.exit(1);
  } finally {
    if (serverProcess) {
      serverProcess.kill('SIGTERM');
    }
    if (mongod) {
      await mongod.stop();
    }
  }
};

main();
