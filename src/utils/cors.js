const cors = require('cors');

const corsOptions = {
  origin: (origin, callback) => {
    // Allow all origins
    callback(null, origin);
  },
  credentials: true, // Allow credentials
  optionsSuccessStatus: 200
};

module.exports = cors(corsOptions);
