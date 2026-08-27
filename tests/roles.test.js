const config = require('config');

const { startTestApp, stopTestApp, clearDb, createAuthedUser, request } = require('./helpers');

const PERMISSIONS = config.get('internalAccess.permissions');

describe('roles API', () => {
  let cookie;

  beforeAll(async () => {
    await startTestApp();
  });

  afterAll(async () => {
    await stopTestApp();
  });

  beforeEach(async () => {
    await clearDb();
    ({ cookie } = await createAuthedUser({
      permissions: [PERMISSIONS.usersRead]
    }));
  });

  it('lists roles with default pagination when page and pageSize are omitted', async () => {
    const res = await request().get('/v1/roles').set('Cookie', cookie);

    expect(res.body.ok).toBe(true);
    expect(res.body.data.page).toBe(1);
    expect(res.body.data.limit).toBe(50);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items.length).toBeGreaterThan(0);
  });

  it('rejects fractional page and pageSize query params', async () => {
    const fractionalPage = await request()
      .get('/v1/roles')
      .query({ page: '2.5' })
      .set('Cookie', cookie);
    expect(fractionalPage.body.ok).toBe(false);
    expect(fractionalPage.body.err).toMatch(/page/i);

    const fractionalPageSize = await request()
      .get('/v1/roles')
      .query({ pageSize: '2.5' })
      .set('Cookie', cookie);
    expect(fractionalPageSize.body.ok).toBe(false);
    expect(fractionalPageSize.body.err).toMatch(/pageSize/i);
  });
});
