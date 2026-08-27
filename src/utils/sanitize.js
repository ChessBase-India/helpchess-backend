const FIELD_LIMITS = {
  name: 200,
  email: 254,
  phone: 30,
  pan: 20,
  address: 500,
  notes: 2000,
  utrNumber: 64
};

const sanitizeString = (value, maxLength) => {
  if (value === undefined || value === null) {
    return value;
  }
  if (typeof value !== 'string') {
    return value;
  }
  return value.slice(0, maxLength).trim();
};

const emptyToUndefined = (value) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'string' && value.trim() === '') {
    return undefined;
  }
  return value;
};

const sanitizeDonorFields = (input = {}) => {
  const donorData = {};

  if (input.name !== undefined) {
    donorData.name = sanitizeString(input.name, FIELD_LIMITS.name);
  }
  if (input.email !== undefined) {
    donorData.email = sanitizeString(input.email, FIELD_LIMITS.email);
  }
  if (input.phone !== undefined) {
    donorData.phone = emptyToUndefined(sanitizeString(input.phone, FIELD_LIMITS.phone));
  }
  if (input.pan !== undefined) {
    donorData.pan = emptyToUndefined(sanitizeString(input.pan, FIELD_LIMITS.pan));
  }
  if (input.address !== undefined) {
    donorData.address = emptyToUndefined(sanitizeString(input.address, FIELD_LIMITS.address));
  }
  if (input.notes !== undefined) {
    donorData.notes = emptyToUndefined(sanitizeString(input.notes, FIELD_LIMITS.notes));
  }

  return donorData;
};

const sanitizeDonationFields = (input = {}) => {
  const donationData = {};

  if (input.utrNumber !== undefined) {
    donationData.utrNumber = sanitizeString(input.utrNumber, FIELD_LIMITS.utrNumber);
  }
  if (input.address !== undefined) {
    donationData.address = emptyToUndefined(sanitizeString(input.address, FIELD_LIMITS.address));
  }
  if (input.notes !== undefined) {
    donationData.notes = emptyToUndefined(sanitizeString(input.notes, FIELD_LIMITS.notes));
  }
  if (input.currency !== undefined && typeof input.currency === 'string') {
    donationData.currency = sanitizeString(input.currency, 3).toUpperCase();
  }

  return donationData;
};

module.exports = {
  FIELD_LIMITS,
  sanitizeString,
  emptyToUndefined,
  sanitizeDonorFields,
  sanitizeDonationFields
};
