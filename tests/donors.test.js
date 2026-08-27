const config = require('config');

const {
  startTestApp,
  stopTestApp,
  clearDb,
  createAuthedUser,
  request,
  getApp
} = require('./helpers');

const PERMISSIONS = config.get('internalAccess.permissions');

describe('donors API', () => {
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
      permissions: [PERMISSIONS.donorsRead, PERMISSIONS.donorsWrite]
    }));
  });

  const createDonor = (body, authCookie = cookie) =>
    request().post('/v1/donors').set('Cookie', authCookie).send(body);

  it('rejects unauthenticated donor search', async () => {
    const res = await request().get('/v1/donors');
    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it('rejects donor search without donors.read', async () => {
    const { cookie: writeOnly } = await createAuthedUser({
      permissions: [PERMISSIONS.donorsWrite],
      roleCode: 'write-only'
    });
    const res = await request().get('/v1/donors').set('Cookie', writeOnly);
    expect(res.status).toBe(403);
  });

  it('creates a donor profile and truncates oversized public fields', async () => {
    const longName = `Viswanathan ${'Anand '.repeat(40)}`;
    const longAddress = 'Chess Colony, Chennai. '.repeat(40);

    const res = await createDonor({
      name: longName,
      email: 'anand@example.com',
      phone: '9876543210',
      pan: 'ABCDE1234F',
      address: longAddress,
      notes: 'Grandmaster donor'
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.name.length).toBeLessThanOrEqual(200);
    expect(res.body.data.email).toBe('anand@example.com');
    expect(res.body.data.phone).toBe('9876543210');
    expect(res.body.data.pan).toBe('ABCDE1234F');
    expect(res.body.data.address.length).toBeLessThanOrEqual(500);
    expect(res.body.data.notes).toBe('Grandmaster donor');
    expect(res.body.data).not.toHaveProperty('taxExemptionEligible');
    expect(res.body.data).not.toHaveProperty('totalDonationsCount');
    expect(res.body.data).not.toHaveProperty('totalDonatedAmount');
  });

  it('requires name and email when creating a donor', async () => {
    const missingName = await createDonor({ email: 'x@example.com' });
    expect(missingName.body.ok).toBe(false);
    expect(missingName.body.err).toMatch(/name/i);

    const missingEmail = await createDonor({ name: 'Someone' });
    expect(missingEmail.body.ok).toBe(false);
    expect(missingEmail.body.err).toMatch(/email/i);
  });

  it('searches donors by name, email, or phone with page and limit', async () => {
    await createDonor({
      name: 'Magnus Carlsen',
      email: 'magnus@example.com',
      phone: '1111111111'
    });
    await createDonor({
      name: 'Hikaru Nakamura',
      email: 'hikaru@example.com',
      phone: '2222222222'
    });
    await createDonor({
      name: 'Praggnanandhaa R',
      email: 'pragg@example.com',
      phone: '3333333333'
    });

    const byName = await request()
      .get('/v1/donors')
      .query({ q: 'magnus', page: 1, limit: 10 })
      .set('Cookie', cookie);
    expect(byName.body.ok).toBe(true);
    expect(byName.body.data.items).toHaveLength(1);
    expect(byName.body.data.items[0].name).toBe('Magnus Carlsen');
    expect(byName.body.data.page).toBe(1);
    expect(byName.body.data.limit).toBe(10);
    expect(byName.body.data.total).toBe(1);

    const byEmail = await request().get('/v1/donors').query({ q: 'hikaru@' }).set('Cookie', cookie);
    expect(byEmail.body.data.items).toHaveLength(1);
    expect(byEmail.body.data.items[0].email).toBe('hikaru@example.com');

    const byPhone = await request().get('/v1/donors').query({ q: '3333' }).set('Cookie', cookie);
    expect(byPhone.body.data.items).toHaveLength(1);
    expect(byPhone.body.data.items[0].name).toBe('Praggnanandhaa R');

    const paged = await request()
      .get('/v1/donors')
      .query({ page: 2, limit: 2 })
      .set('Cookie', cookie);
    expect(paged.body.data.items).toHaveLength(1);
    expect(paged.body.data.total).toBe(3);
    expect(paged.body.data.totalPages).toBe(2);
  });

  it('returns donor details with on-demand donation summary', async () => {
    const created = await createDonor({
      name: 'Gukesh D',
      email: 'gukesh@example.com',
      address: 'Chennai'
    });
    const donorId = created.body.data._id;

    const { cookie: donationCookie } = await createAuthedUser({
      permissions: [PERMISSIONS.donationsWrite],
      roleCode: 'donations-writer'
    });

    await request().post('/v1/donations/manual').set('Cookie', donationCookie).send({
      donorId,
      amount: 5000,
      utrNumber: 'SBIN111111111',
      address: 'Chennai'
    });
    await request().post('/v1/donations/manual').set('Cookie', donationCookie).send({
      donorId,
      amount: 2500,
      utrNumber: 'SBIN222222222'
    });

    const res = await request().get(`/v1/donors/${donorId}`).set('Cookie', cookie);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.name).toBe('Gukesh D');
    expect(res.body.data.donationSummary).toEqual({
      totalDonationsCount: 2,
      totalDonatedAmount: 7500
    });
  });

  it('updates donor profile fields', async () => {
    const created = await createDonor({
      name: 'Old Name',
      email: 'old@example.com'
    });

    const res = await request()
      .patch(`/v1/donors/${created.body.data._id}`)
      .set('Cookie', cookie)
      .send({ name: 'New Name', address: 'Updated address' });

    expect(res.body.ok).toBe(true);
    expect(res.body.data.name).toBe('New Name');
    expect(res.body.data.address).toBe('Updated address');
    expect(res.body.data.email).toBe('old@example.com');
  });

  it('returns invalid for unknown donor ids', async () => {
    const res = await request().get('/v1/donors/64ce172dc4eff7ec4ff20e6e').set('Cookie', cookie);
    expect(res.body.ok).toBe(false);
    expect(res.body.err).toMatch(/not found/i);
  });

  it('exports an express app for tests without listening', () => {
    expect(typeof getApp()).toBe('function');
  });
});
