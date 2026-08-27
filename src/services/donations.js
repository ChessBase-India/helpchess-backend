const { error } = require('utils/logger');
const donorsModel = require('models/donors');
const donationsModel = require('models/donations');
const donorsService = require('services/donors');
const { sanitizeDonationFields, sanitizeString, FIELD_LIMITS } = require('utils/sanitize');

const isDuplicateUtr = (e) =>
  e &&
  e.code === 11000 &&
  (e.keyPattern?.utrNumber || (e.message && e.message.includes('utrNumber')));

module.exports = {
  createManual: async ({ donationInput, createdBy }) => {
    try {
      const { donorId, donor, amount, currency, utrNumber, donationDate, address, notes } =
        donationInput;

      const sanitizedDonation = sanitizeDonationFields({ utrNumber, address, notes, currency });
      if (!sanitizedDonation.utrNumber) {
        return { ok: false, msg: 'Invalid/Missing utrNumber' };
      }

      const existingUtr = await donationsModel.findByUtrNumber({
        utrNumber: sanitizedDonation.utrNumber
      });
      if (existingUtr) {
        return {
          ok: false,
          msg: 'A donation with this UTR number already exists',
          duplicate: true
        };
      }

      let resolvedDonor;
      if (donorId) {
        resolvedDonor = await donorsModel.getById({ id: donorId });
        if (!resolvedDonor) {
          return { ok: false, msg: 'Donor not found' };
        }
      } else if (donor) {
        const createdDonor = await donorsService.create({ donorData: donor });
        if (!createdDonor.ok || !createdDonor.data) {
          return createdDonor;
        }
        resolvedDonor = createdDonor.data;
      } else {
        return { ok: false, msg: 'Either donorId or donor is required' };
      }

      const snapshotAddress =
        sanitizedDonation.address ||
        (resolvedDonor.address
          ? sanitizeString(resolvedDonor.address, FIELD_LIMITS.address)
          : undefined);

      const donationData = {
        donorId: resolvedDonor._id,
        amount,
        currency: sanitizedDonation.currency || 'INR',
        utrNumber: sanitizedDonation.utrNumber,
        createdBy,
        address: snapshotAddress,
        notes: sanitizedDonation.notes
      };
      if (donationDate) {
        donationData.donationDate = donationDate;
      }

      const donation = await donationsModel.createManualBank({ donationData });
      if (!donation) {
        return { ok: false, msg: 'Unable to create donation!' };
      }

      if (sanitizedDonation.address && sanitizedDonation.address !== resolvedDonor.address) {
        await donorsModel.patch({
          id: resolvedDonor._id,
          updateData: { address: sanitizedDonation.address }
        });
      }

      const populated = await donationsModel.populateDonor({ donation });
      return { ok: true, data: populated };
    } catch (e) {
      error(e);
      if (isDuplicateUtr(e)) {
        return {
          ok: false,
          msg: 'A donation with this UTR number already exists',
          duplicate: true
        };
      }
      if (e.name === 'ValidationError') {
        return { ok: false, msg: e.message };
      }
      return { ok: false, msg: 'Something went wrong, we are looking into it!' };
    }
  },

  getById: async ({ id }) => {
    try {
      const donation = await donationsModel.getById({ id });
      if (!donation) {
        return { ok: false, msg: 'Donation not found.' };
      }
      return { ok: true, data: donation };
    } catch (e) {
      error(e);
      return { ok: false, msg: 'Something went wrong, we are looking into it!' };
    }
  },

  patch: async ({ id, updateData }) => {
    try {
      const existing = await donationsModel.getById({ id });
      if (!existing) {
        return { ok: false, msg: 'Donation not found.' };
      }
      if (existing.source !== 'manual_bank') {
        return { ok: false, msg: 'Only manual bank donations can be updated', invalid: true };
      }

      const sanitized = sanitizeDonationFields(updateData);
      const patchPayload = {};

      if (updateData.utrNumber !== undefined) {
        if (!sanitized.utrNumber) {
          return { ok: false, msg: 'Invalid utrNumber' };
        }
        const utrOwner = await donationsModel.findByUtrNumber({
          utrNumber: sanitized.utrNumber
        });
        if (utrOwner && utrOwner._id.toString() !== id.toString()) {
          return {
            ok: false,
            msg: 'A donation with this UTR number already exists',
            duplicate: true
          };
        }
        patchPayload.utrNumber = sanitized.utrNumber;
      }

      if (updateData.donationDate !== undefined) {
        patchPayload.donationDate = updateData.donationDate;
      }
      if (updateData.address !== undefined) {
        patchPayload.address = sanitized.address;
      }
      if (updateData.notes !== undefined) {
        patchPayload.notes = sanitized.notes;
      }

      const donation = await donationsModel.patchManualBank({ id, updateData: patchPayload });
      if (!donation) {
        return { ok: false, msg: 'Donation not found or unable to update.' };
      }

      if (sanitized.address && sanitized.address !== existing.donorId?.address) {
        const donorId = existing.donorId?._id || existing.donorId;
        await donorsModel.patch({ id: donorId, updateData: { address: sanitized.address } });
      }

      return { ok: true, data: donation };
    } catch (e) {
      error(e);
      if (isDuplicateUtr(e)) {
        return {
          ok: false,
          msg: 'A donation with this UTR number already exists',
          duplicate: true
        };
      }
      if (e.name === 'ValidationError') {
        return { ok: false, msg: e.message };
      }
      return { ok: false, msg: 'Something went wrong, we are looking into it!' };
    }
  }
};
