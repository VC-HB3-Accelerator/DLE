const winston = require('winston');
const path = require('path');

const SENSITIVE_KEY_REGEX = /(address|wallet|signature|provider_id|private|secret|rpc|api(?:key)?|auth|token_address|contract)/i;
const IPV4_REGEX = /\b(\d{1,3}\.){3}\d{1,3}\b/g;
const IPV6_REGEX = /([a-f0-9]{1,4}:){1,7}[a-f0-9]{1,4}/gi;
const ETH_ADDRESS_REGEX = /0x[a-fA-F0-9]{40}/g;
const ETH_TX_REGEX = /0x[a-fA-F0-9]{64}/g;
const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

const maskEthereumAddress = (value) => {
  return value.replace(ETH_ADDRESS_REGEX, (match) => `${match.slice(0, 6)}...${match.slice(-4)}`);
};

const maskEthereumHash = (value) => {
  return value.replace(ETH_TX_REGEX, (match) => `${match.slice(0, 10)}...${match.slice(-6)}`);
};

const maskIpAddresses = (value) => {
  return value
    .replace(IPV4_REGEX, '***.***.***.***')
    .replace(IPV6_REGEX, '[REDACTED_IP]');
};

const maskEmails = (value) => {
  return value.replace(EMAIL_REGEX, (match) => {
    const [local, domain] = match.split('@');
    if (!domain) {
      return '[REDACTED_EMAIL]';
    }
    const hiddenLocal = local.length <= 2 ? '**' : `${local.slice(0, 2)}***`;
    return `${hiddenLocal}@${domain}`;
  });
};

const redactString = (value) => {
  if (!value) {
    return value;
  }
  let sanitized = value;
  sanitized = maskEthereumAddress(sanitized);
  sanitized = maskEthereumHash(sanitized);
  sanitized = maskIpAddresses(sanitized);
  sanitized = maskEmails(sanitized);
  return sanitized;
};

const sanitizeValue = (value, keyPath = '', seen = new WeakSet()) => {
  if (typeof value === 'string') {
    if (SENSITIVE_KEY_REGEX.test(keyPath)) {
      return '[REDACTED]';
    }
    return redactString(value);
  }

  if (typeof value === 'number') {
    if (SENSITIVE_KEY_REGEX.test(keyPath)) {
      return '[REDACTED]';
    }
    return value;
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  if (seen.has(value)) {
    return '[REDACTED]';
  }
  seen.add(value);

  if (value instanceof Error) {
    const sanitizedError = {};
    Object.getOwnPropertyNames(value).forEach((prop) => {
      sanitizedError[prop] = sanitizeValue(value[prop], `${keyPath}.${prop}`, seen);
    });
    return sanitizedError;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => sanitizeValue(item, `${keyPath}[${index}]`, seen));
  }

  const sanitizedObject = {};
  Object.keys(value).forEach((key) => {
    const nextPath = keyPath ? `${keyPath}.${key}` : key;
    if (SENSITIVE_KEY_REGEX.test(key)) {
      sanitizedObject[key] = '[REDACTED]';
    } else {
      sanitizedObject[key] = sanitizeValue(value[key], nextPath, seen);
    }
  });
  return sanitizedObject;
};

const sanitizeInfo = (info) => {
  const sanitizedInfo = { ...info };
  sanitizedInfo.message = sanitizeValue(info.message, 'message');
  const splat = Symbol.for('splat');
  if (info[splat]) {
    sanitizedInfo[splat] = info[splat].map((entry, index) => sanitizeValue(entry, `splat[${index}]`));
  }

  Object.keys(info).forEach((key) => {
    if (['level', 'message', 'timestamp'].includes(key)) {
      return;
    }
    sanitizedInfo[key] = sanitizeValue(info[key], key);
  });

  return sanitizedInfo;
};

const sanitizeFormat = winston.format((info) => sanitizeInfo(info));

const jsonFormat = winston.format.combine(
  sanitizeFormat(),
  winston.format.timestamp(),
  winston.format.json()
);

const consoleFormat = winston.format.combine(
  sanitizeFormat(),
  winston.format.timestamp(),
  winston.format.colorize({ all: true }),
  winston.format.printf((info) => {
    const { timestamp, level, message, ...rest } = info;
    const metaParts = [];
    const splat = info[Symbol.for('splat')];
    if (splat && Array.isArray(splat)) {
      splat.forEach((entry) => {
        if (entry === undefined) {
          return;
        }
        if (typeof entry === 'string') {
          metaParts.push(entry);
        } else {
          metaParts.push(JSON.stringify(entry));
        }
      });
    }

    Object.keys(rest)
      .filter((key) => !['level', 'message', 'timestamp'].includes(key))
      .forEach((key) => {
        if (key === Symbol.for('splat')) {
          return;
        }
        const value = rest[key];
        if (value !== undefined) {
          metaParts.push(`${key}=${JSON.stringify(value)}`);
        }
      });

    const metaString = metaParts.length ? ` ${metaParts.join(' ')}` : '';
    return `${timestamp} ${level}: ${message}${metaString}`;
  })
);

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: jsonFormat,
  transports: [
    new winston.transports.Console({
      format: consoleFormat,
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/error.log'),
      level: 'error',
      format: jsonFormat,
    }),
    new winston.transports.File({
      filename: path.join(__dirname, '../logs/combined.log'),
      format: jsonFormat,
    }),
  ],
});

const wrapConsoleMethod = (methodName) => {
  const original = console[methodName].bind(console);
  console[methodName] = (...args) => {
    const sanitizedArgs = args.map((arg, index) => sanitizeValue(arg, `${methodName}[${index}]`));
    original(...sanitizedArgs);
  };
};

['log', 'info', 'warn', 'error', 'debug'].forEach(wrapConsoleMethod);

module.exports = logger;
