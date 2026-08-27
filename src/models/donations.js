const mongoose = require('mongoose');

const DONOR_POPULATE = { path: 'donorId' };

const baseDonationSchema = new mongoose.Schema(
  {
    donorId: { type: mongoose.Schema.Types.ObjectId, ref: 'donors', required: true, index: true },
    amount: { type: Number, required: true, min: 1 },
    currency: { type: String, default: 'INR', uppercase: true },
    donationDate: { type: Date, default: Date.now, index: true },
    status: {
      type: String,
      enum: ['captured', 'refunded', 'cancelled'],
      default: 'captured'
    },
    receiptNumber: { type: String, trim: true, index: true, unique: true, sparse: true },
    receiptSentAt: { type: Date },
    certificateSentAt: { type: Date },
    address: { type: String, trim: true },
    notes: { type: String, trim: true }
  },
  {
    discriminatorKey: 'source',
    collection: 'donations',
    timestamps: true
  }
);

const Donation = mongoose.model('donations', baseDonationSchema);

const manualBankSchema = new mongoose.Schema({
  utrNumber: { type: String, required: true, trim: true, uppercase: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'users', required: true }
});
manualBankSchema.index({ utrNumber: 1 }, { unique: true, sparse: true });

const ManualBankDonation = Donation.discriminator('manual_bank', manualBankSchema);

const razorpayWebhookSchema = new mongoose.Schema({
  razorpayPaymentId: {
    type: String,
    required: true,
    trim: true,
    index: true,
    unique: true,
    sparse: true
  },
  razorpayOrderId: { type: String, trim: true },
  razorpayFee: { type: Number },
  razorpayTax: { type: Number },
  webhookEventId: { type: String, trim: true }
});

const RazorpayWebhookDonation = Donation.discriminator('razorpay_webhook', razorpayWebhookSchema);

const razorpaySyncSchema = new mongoose.Schema({
  razorpayPaymentId: {
    type: String,
    required: true,
    trim: true,
    index: true,
    unique: true,
    sparse: true
  },
  razorpayOrderId: { type: String, trim: true },
  razorpayFee: { type: Number },
  razorpayTax: { type: Number },
  syncedAt: { type: Date, default: Date.now },
  syncBatchId: { type: mongoose.Schema.Types.ObjectId }
});

const RazorpaySyncDonation = Donation.discriminator('razorpay_sync', razorpaySyncSchema);

const toObjectId = (id) => (typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id);

module.exports = {
  Donation,
  ManualBankDonation,
  RazorpayWebhookDonation,
  RazorpaySyncDonation,

  createManualBank: async ({ donationData }) => new ManualBankDonation(donationData).save(),

  getById: async ({ id }) => Donation.findById(id).populate(DONOR_POPULATE).lean(),

  findByUtrNumber: async ({ utrNumber }) =>
    ManualBankDonation.findOne({ utrNumber: utrNumber.toUpperCase() }).lean(),

  patchManualBank: async ({ id, updateData }) =>
    ManualBankDonation.findByIdAndUpdate(id, updateData, { new: true })
      .populate(DONOR_POPULATE)
      .lean(),

  populateDonor: async ({ donation }) =>
    Donation.findById(donation._id).populate(DONOR_POPULATE).lean(),

  aggregateByDonorId: async ({ donorId }) => {
    const [summary] = await Donation.aggregate([
      {
        $match: {
          donorId: toObjectId(donorId),
          status: 'captured'
        }
      },
      {
        $group: {
          _id: '$donorId',
          totalDonationsCount: { $sum: 1 },
          totalDonatedAmount: { $sum: '$amount' }
        }
      }
    ]);

    return {
      totalDonationsCount: summary ? summary.totalDonationsCount : 0,
      totalDonatedAmount: summary ? summary.totalDonatedAmount : 0
    };
  }
};
