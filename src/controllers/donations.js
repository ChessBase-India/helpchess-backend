const { isValidObjectId } = require('mongoose');

const { error } = require('utils/logger');
const donationsService = require('services/donations');
const authService = require('services/auth');

const isValidDate = (value) => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
};

module.exports = {
  createManual: async (req, res) => {
    try {
      const { donorId, donor, amount, currency, utrNumber, donationDate, address, notes } =
        req.body;

      if (donorId !== undefined && donorId !== null && donorId !== '') {
        if (typeof donorId !== 'string' || !isValidObjectId(donorId)) {
          return res.invalid({ msg: 'Invalid donorId' });
        }
      } else if (!donor || typeof donor !== 'object' || Array.isArray(donor)) {
        return res.invalid({ msg: 'Either donorId or donor is required' });
      } else {
        if (!donor.name || typeof donor.name !== 'string' || donor.name.trim().length === 0) {
          return res.invalid({ msg: 'Invalid/Missing donor.name' });
        }
        if (
          !donor.email ||
          typeof donor.email !== 'string' ||
          !authService.isValidEmail(donor.email.trim())
        ) {
          return res.invalid({ msg: 'Invalid/Missing donor.email' });
        }
      }

      if (
        amount === undefined ||
        amount === null ||
        Number.isNaN(Number(amount)) ||
        Number(amount) < 1
      ) {
        return res.invalid({ msg: 'Invalid/Missing amount' });
      }
      if (!utrNumber || typeof utrNumber !== 'string' || utrNumber.trim().length === 0) {
        return res.invalid({ msg: 'Invalid/Missing utrNumber' });
      }
      if (
        currency !== undefined &&
        (typeof currency !== 'string' || currency.trim().length === 0)
      ) {
        return res.invalid({ msg: 'Invalid currency' });
      }
      if (donationDate !== undefined && !isValidDate(donationDate)) {
        return res.invalid({ msg: 'Invalid donationDate' });
      }
      if (address !== undefined && typeof address !== 'string') {
        return res.invalid({ msg: 'Invalid address' });
      }
      if (notes !== undefined && typeof notes !== 'string') {
        return res.invalid({ msg: 'Invalid notes' });
      }

      const response = await donationsService.createManual({
        donationInput: {
          donorId: donorId || undefined,
          donor,
          amount: Number(amount),
          currency,
          utrNumber,
          donationDate,
          address,
          notes
        },
        createdBy: req.userId
      });
      if (!response.ok || !response.data) {
        if (response.duplicate) {
          return res.invalid({ msg: response.msg });
        }
        return res.failure({ msg: response.msg || 'Unable to create donation!' });
      }
      return res.success({ data: response.data });
    } catch (e) {
      error(e);
      return res.failure({ msg: 'Something went wrong!' });
    }
  },

  getById: async (req, res) => {
    try {
      const { id } = req.params;
      if (!id || !isValidObjectId(id)) {
        return res.invalid({ msg: 'Invalid/Missing donation id' });
      }

      const response = await donationsService.getById({ id });
      if (!response.ok || !response.data) {
        return res.invalid({ msg: response.msg || 'Donation not found' });
      }
      return res.success({ data: response.data });
    } catch (e) {
      error(e);
      return res.failure({ msg: 'Something went wrong!' });
    }
  },

  patch: async (req, res) => {
    try {
      const { id } = req.params;
      const { utrNumber, donationDate, address, notes } = req.body;

      if (!id || !isValidObjectId(id)) {
        return res.invalid({ msg: 'Invalid/Missing donation id' });
      }

      const updateData = {};
      if (utrNumber !== undefined) {
        if (typeof utrNumber !== 'string' || utrNumber.trim().length === 0) {
          return res.invalid({ msg: 'Invalid utrNumber' });
        }
        updateData.utrNumber = utrNumber;
      }
      if (donationDate !== undefined) {
        if (!isValidDate(donationDate)) {
          return res.invalid({ msg: 'Invalid donationDate' });
        }
        updateData.donationDate = donationDate;
      }
      if (address !== undefined) {
        if (typeof address !== 'string') {
          return res.invalid({ msg: 'Invalid address' });
        }
        updateData.address = address;
      }
      if (notes !== undefined) {
        if (typeof notes !== 'string') {
          return res.invalid({ msg: 'Invalid notes' });
        }
        updateData.notes = notes;
      }

      if (Object.keys(updateData).length === 0) {
        return res.invalid({ msg: 'No valid fields to update' });
      }

      const response = await donationsService.patch({ id, updateData });
      if (!response.ok || !response.data) {
        if (response.duplicate || response.invalid) {
          return res.invalid({ msg: response.msg });
        }
        return res.failure({ msg: response.msg || 'Unable to update donation!' });
      }
      return res.success({ data: response.data });
    } catch (e) {
      error(e);
      return res.failure({ msg: 'Something went wrong!' });
    }
  }
};
