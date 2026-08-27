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

  it('deletes only the inline donor by _id when donation save hits a duplicate UTR', async () => {
    const existingRes = await createDonor({
      name: 'Preexisting Same Email',
      email: 'shared-email@example.com'
    });
    const preexistingId = existingRes.body.data._id;

    const first = await createManual({
      donor: { name: 'Utr Holder', email: 'utr-holder@example.com' },
      amount: 1000,
      utrNumber: 'RACEUTR001'
    });
    expect(first.body.ok).toBe(true);
    const firstDonationId = first.body.data._id;

    const createSpy = jest.spyOn(donorsModel, 'create');
    const findSpy = jest.spyOn(donationsModel, 'findByUtrNumber').mockResolvedValueOnce(null);

    try {
      const res = await createManual({
        donor: { name: 'Inline Same Email', email: 'shared-email@example.com' },
        amount: 2000,
        utrNumber: 'RACEUTR001'
      });

      expect(res.body.ok).toBe(false);
      expect(res.body.err).toMatch(/UTR/i);

      const createdDonor = await createSpy.mock.results[0].value;
      const inlineDonorId = createdDonor._id;
      expect(inlineDonorId.toString()).not.toBe(preexistingId.toString());
      expect(await donorsModel.getById({ id: inlineDonorId })).toBeNull();

      const preexisting = await donorsModel.getById({ id: preexistingId });
      expect(preexisting).not.toBeNull();
      expect(preexisting.email).toBe('shared-email@example.com');
      expect(preexisting.name).toBe('Preexisting Same Email');

      findSpy.mockRestore();
      const utrDonation = await donationsModel.findByUtrNumber({ utrNumber: 'RACEUTR001' });
      expect(utrDonation).not.toBeNull();
      expect(utrDonation._id.toString()).toBe(firstDonationId);
    } finally {
      createSpy.mockRestore();
      findSpy.mockRestore();
    }
  });

  it('does not delete an existing donor when donation persist fails', async () => {
    const donorRes = await createDonor({
      name: 'Keep Me',
      email: 'keep-me@example.com'
    });
    const donorId = donorRes.body.data._id;

    const duplicateUtrError = new Error('E11000 duplicate key error');
    duplicateUtrError.code = 11000;
    duplicateUtrError.keyPattern = { utrNumber: 1 };
    const saveSpy = jest
      .spyOn(donationsModel, 'createManualBank')
      .mockRejectedValueOnce(duplicateUtrError);

    try {
      const res = await createManual({
        donorId,
        amount: 1000,
        utrNumber: 'KEEPMEUTR001'
      });

      expect(res.body.ok).toBe(false);
      expect(res.body.err).toMatch(/UTR/i);

      const donor = await donorsModel.getById({ id: donorId });
      expect(donor).not.toBeNull();
      expect(donor.email).toBe('keep-me@example.com');
    } finally {
      saveSpy.mockRestore();
    }
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

  it('rejects non-finite amounts', async () => {
    const donorRes = await createDonor({
      name: 'Amount Donor',
      email: 'amount@example.com'
    });
    const donorId = donorRes.body.data._id;

    const infinity = await createManual({
      donorId,
      amount: 'Infinity',
      utrNumber: 'AMTINF001'
    });
    expect(infinity.body.ok).toBe(false);
    expect(infinity.body.err).toMatch(/amount/i);

    const negativeInfinity = await createManual({
      donorId,
      amount: '-Infinity',
      utrNumber: 'AMTNEGINF001'
    });
    expect(negativeInfinity.body.ok).toBe(false);
    expect(negativeInfinity.body.err).toMatch(/amount/i);

    const notANumber = await createManual({
      donorId,
      amount: 'NaN',
      utrNumber: 'AMTNAN001'
    });
    expect(notANumber.body.ok).toBe(false);
    expect(notANumber.body.err).toMatch(/amount/i);
  });

  it('rejects non-INR currencies on create and patch', async () => {
    const created = await createManual({
      donor: { name: 'Inr Donor', email: 'inr-currency@example.com' },
      amount: 1000,
      currency: 'INR',
      utrNumber: 'INRCURR001'
    });
    expect(created.body.ok).toBe(true);
    expect(created.body.data.currency).toBe('INR');

    const usd = await createManual({
      donor: { name: 'Usd Donor', email: 'usd-currency@example.com' },
      amount: 1000,
      currency: 'USD',
      utrNumber: 'USDCURR001'
    });
    expect(usd.body.ok).toBe(false);
    expect(usd.body.err).toMatch(/currency/i);

    const patched = await request()
      .patch(`/v1/donations/${created.body.data._id}`)
      .set('Cookie', cookie)
      .send({ currency: 'USD', notes: 'try usd' });
    expect(patched.body.ok).toBe(false);
    expect(patched.body.err).toMatch(/currency/i);
  });

  it('returns the created donation when donor address sync fails', async () => {
    const donorRes = await createDonor({
      name: 'Sync Fail Donor',
      email: 'sync-fail@example.com',
      address: 'Old Street'
    });
    const donorId = donorRes.body.data._id;
    const patchSpy = jest
      .spyOn(donorsModel, 'patch')
      .mockRejectedValueOnce(new Error('sync failed'));

    try {
      const res = await createManual({
        donorId,
        amount: 1500,
        utrNumber: 'BESTEFFORTUTR1',
        address: 'New Street'
      });

      expect(res.body.ok).toBe(true);
      expect(res.body.data.address).toBe('New Street');
      expect(res.body.data.utrNumber).toBe('BESTEFFORTUTR1');

      const donor = await donorsModel.getById({ id: donorId });
      expect(donor.address).toBe('Old Street');
    } finally {
      patchSpy.mockRestore();
    }
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
  });

  it('fails with Mongo duplicate key 11000 when webhook and sync share the same razorpayPaymentId', async () => {
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

  it('rejects PATCH /v1/donations/:id on a razorpay webhook or sync row with a client error', async () => {
    const donor = await donorsModel.create({
      donorData: { name: 'Razorpay Patch Donor', email: 'rzp-patch@example.com' }
    });
    const webhook = await donationsModel.RazorpayWebhookDonation.create({
      donorId: donor._id,
      amount: 2000,
      razorpayPaymentId: 'pay_patch_blocked_1'
    });

    const res = await request()
      .patch(`/v1/donations/${webhook._id}`)
      .set('Cookie', cookie)
      .send({ notes: 'should not apply' });

    expect(res.body.ok).toBe(false);
    expect(res.body.err).toMatch(/manual bank/i);
    expect(res.body.data).toBeNull();

    const unchanged = await donationsModel.Donation.findById(webhook._id).lean();
    expect(unchanged.notes).toBeUndefined();
  });
});
