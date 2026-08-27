const config = require('config');

const donationsModel = require('models/donations');
const donorsModel = require('models/donors');
const { startTestApp, stopTestApp, clearDb, createAuthedUser, request } = require('./helpers');

const PERMISSIONS = config.get('internalAccess.permissions');

describe('manual donations API', () => {
  let cookie;
  let user;

  beforeAll(async () => {
    await startTestApp();
  });

  afterAll(async () => {
    await stopTestApp();
  });

  beforeEach(async () => {
    await clearDb();
    ({ cookie, user } = await createAuthedUser({
      permissions: [
        PERMISSIONS.donorsRead,
        PERMISSIONS.donorsWrite,
        PERMISSIONS.donationsRead,
        PERMISSIONS.donationsWrite
      ]
    }));
  });

  const createDonor = (body) => request().post('/v1/donors').set('Cookie', cookie).send(body);

  const createManual = (body) =>
    request().post('/v1/donations/manual').set('Cookie', cookie).send(body);

  it('records a manual donation against an existing donor and snapshots address', async () => {
    const donorRes = await createDonor({
      name: 'Existing Donor',
      email: 'existing@example.com',
      address: 'Old Street'
    });
    const donorId = donorRes.body.data._id;

    const res = await createManual({
      donorId,
      amount: 5000,
      currency: 'inr',
      utrNumber: 'sbin123456789',
      donationDate: '2026-08-25T10:00:00Z',
      address: 'New Street, Chennai',
      notes: 'Direct bank transfer'
    });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.data.source).toBe('manual_bank');
    expect(res.body.data.amount).toBe(5000);
    expect(res.body.data.currency).toBe('INR');
    expect(res.body.data.utrNumber).toBe('SBIN123456789');
    expect(res.body.data.address).toBe('New Street, Chennai');
    expect(res.body.data.notes).toBe('Direct bank transfer');
    expect(res.body.data.createdBy.toString()).toBe(user._id.toString());
    expect(res.body.data.donorId._id.toString()).toBe(donorId);
    expect(res.body.data.donorId.name).toBe('Existing Donor');
    expect(res.body.data).not.toHaveProperty('receipt');
    expect(res.body.data).not.toHaveProperty('certificate');
    expect(res.body.data.receiptNumber == null).toBe(true);

    const updatedDonor = await request().get(`/v1/donors/${donorId}`).set('Cookie', cookie);
    expect(updatedDonor.body.data.address).toBe('New Street, Chennai');
  });

  it('creates a donor inline when recording a manual donation', async () => {
    const res = await createManual({
      donor: {
        name: `Inline ${'Name '.repeat(80)}`,
        email: 'inline@example.com',
        phone: '9998887777',
        pan: 'fghij5678k',
        address: 'Inline Address'
      },
      amount: 10000,
      utrNumber: 'HDFC999888777',
      notes: 'Created with donor'
    });

    expect(res.body.ok).toBe(true);
    expect(res.body.data.source).toBe('manual_bank');
    expect(res.body.data.donorId.email).toBe('inline@example.com');
    expect(res.body.data.donorId.pan).toBe('FGHIJ5678K');
    expect(res.body.data.donorId.name.length).toBeLessThanOrEqual(200);
    expect(res.body.data.address).toBe('Inline Address');
    expect(res.body.data.utrNumber).toBe('HDFC999888777');
  });

  it('rejects a duplicate UTR on manual donations', async () => {
    const first = await createManual({
      donor: { name: 'First', email: 'first@example.com' },
      amount: 1000,
      utrNumber: 'UTRDUP123456'
    });
    expect(first.body.ok).toBe(true);

    const duplicate = await createManual({
      donor: { name: 'Second', email: 'second@example.com' },
      amount: 2000,
      utrNumber: 'utrdup123456'
    });

    expect(duplicate.body.ok).toBe(false);
    expect(duplicate.body.err).toMatch(/UTR/i);
    expect(duplicate.body.data).toBeNull();
  });

  it('fetches and patches a manual donation', async () => {
    const created = await createManual({
      donor: { name: 'Patch Me', email: 'patch@example.com', address: 'A' },
      amount: 3000,
      utrNumber: 'PATCHUTR0001',
      notes: 'original'
    });
    const donationId = created.body.data._id;

    const fetched = await request().get(`/v1/donations/${donationId}`).set('Cookie', cookie);
    expect(fetched.body.ok).toBe(true);
    expect(fetched.body.data.utrNumber).toBe('PATCHUTR0001');
    expect(fetched.body.data.donorId.email).toBe('patch@example.com');

    const patched = await request()
      .patch(`/v1/donations/${donationId}`)
      .set('Cookie', cookie)
      .send({ notes: 'corrected', address: 'B Street', utrNumber: 'PATCHUTR0002' });

    expect(patched.body.ok).toBe(true);
    expect(patched.body.data.notes).toBe('corrected');
    expect(patched.body.data.address).toBe('B Street');
    expect(patched.body.data.utrNumber).toBe('PATCHUTR0002');
  });

  it('does not expose a donations list endpoint', async () => {
    const res = await request().get('/v1/donations').set('Cookie', cookie);
    expect(res.status).toBe(404);
  });

  it('creates razorpay_webhook and razorpay_sync discriminator documents on the donations collection', async () => {
    const donor = await donorsModel.create({
      donorData: { name: 'Razorpay Donor', email: 'rzp@example.com' }
    });

    const webhook = await donationsModel.RazorpayWebhookDonation.create({
      donorId: donor._id,
      amount: 1500,
      razorpayPaymentId: 'pay_webhook_1',
      razorpayOrderId: 'order_1',
      webhookEventId: 'evt_1'
    });
    const sync = await donationsModel.RazorpaySyncDonation.create({
      donorId: donor._id,
      amount: 1500,
      razorpayPaymentId: 'pay_sync_1',
      syncedAt: new Date(),
      syncBatchId: donor._id
    });

    expect(webhook.source).toBe('razorpay_webhook');
    expect(sync.source).toBe('razorpay_sync');
    expect(webhook.collection.collectionName).toBe('donations');
    expect(sync.collection.collectionName).toBe('donations');
  });

  it('enforces a collection-wide unique sparse index on razorpayPaymentId', async () => {
    const indexes = await donationsModel.Donation.collection.indexes();
    const paymentIdIndex = indexes.find((index) => index.key && index.key.razorpayPaymentId === 1);

    expect(paymentIdIndex).toBeDefined();
    expect(paymentIdIndex.unique).toBe(true);
    expect(paymentIdIndex.sparse).toBe(true);
    expect(paymentIdIndex.partialFilterExpression).toBeUndefined();

    const webhookPaymentId =
      donationsModel.RazorpayWebhookDonation.schema.path('razorpayPaymentId');
    const syncPaymentId = donationsModel.RazorpaySyncDonation.schema.path('razorpayPaymentId');
    expect(webhookPaymentId.options.unique).toBeFalsy();
    expect(syncPaymentId.options.unique).toBeFalsy();

    const donor = await donorsModel.create({
      donorData: { name: 'Dup Pay Donor', email: 'dup-pay@example.com' }
    });

    await donationsModel.RazorpayWebhookDonation.create({
      donorId: donor._id,
      amount: 1500,
      razorpayPaymentId: 'pay_shared_1'
    });

    await expect(
      donationsModel.RazorpaySyncDonation.create({
        donorId: donor._id,
        amount: 1500,
        razorpayPaymentId: 'pay_shared_1'
      })
    ).rejects.toMatchObject({ code: 11000 });
  });
});
