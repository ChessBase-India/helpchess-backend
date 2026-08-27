const parseStrictPositiveInt = (value) => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return NaN;
  }
  return Number(value);
};

module.exports = { parseStrictPositiveInt };
