const util = require('util');
const VError = require('verror');

const winstonLogger = require('utils/winstonLogger');

// compact + breakLength keep one log call on one line; without compact,
// util.inspect still wraps deeply nested objects.
const formatArg = (arg) => {
  if (typeof arg === 'string') {
    return arg;
  }
  if (arg instanceof Error) {
    return VError.fullStack(arg);
  }
  return util.inspect(arg, { depth: 4, breakLength: Infinity, compact: true });
};

// Levels below warning are promoted so an Error can't hide in a DEBUG line,
// which the file transport drops.
const severityFor = ({ args, logLevel }) => {
  if (!args.some((arg) => arg instanceof Error)) {
    return logLevel;
  }
  return winstonLogger.levels[logLevel] <= winstonLogger.levels.warning ? logLevel : 'error';
};

const writeLog = ({ args, logLevel = 'info' }) => {
  if (!args.length || args.every((arg) => arg === null || arg === undefined)) {
    return;
  }

  const [logObject] = args;

  // vErrorLogLevel overrides the requested severity, but only for a lone Error:
  // with context args there is no single error to take the override from.
  if (args.length === 1 && logObject instanceof Error) {
    const { vErrorLogLevel } = VError.info(logObject);
    if (Object.prototype.hasOwnProperty.call(winstonLogger.levels, vErrorLogLevel)) {
      if (winstonLogger.levels[vErrorLogLevel] <= winstonLogger.levels.warning) {
        winstonLogger[vErrorLogLevel](VError.fullStack(logObject));
      } else {
        winstonLogger[vErrorLogLevel](logObject.message);
      }
      return;
    }
  }

  winstonLogger[severityFor({ args, logLevel })](args.map(formatArg).join(' '));
};

const logger = {
  log: (...args) => {
    writeLog({ args });
  },

  debug: (...args) => {
    writeLog({ args, logLevel: 'debug' });
  },

  info: (...args) => {
    writeLog({ args, logLevel: 'info' });
  },

  notice: (...args) => {
    writeLog({ args, logLevel: 'notice' });
  },

  warning: (...args) => {
    writeLog({ args, logLevel: 'warning' });
  },

  error: (...args) => {
    writeLog({ args, logLevel: 'error' });
  },

  crit: (...args) => {
    writeLog({ args, logLevel: 'crit' });
  },

  alert: (...args) => {
    writeLog({ args, logLevel: 'alert' });
  },

  emerg: (...args) => {
    writeLog({ args, logLevel: 'emerg' });
  }
};

module.exports = logger;
