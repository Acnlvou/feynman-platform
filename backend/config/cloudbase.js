const cloudbase = require('@cloudbase/js-sdk');

let database;

function hasCloudBaseConfig() {
  return Boolean(
    process.env.CLOUDBASE_ENV_ID?.trim() && process.env.CLOUDBASE_APIKEY?.trim()
  );
}

function getDatabase() {
  const env = process.env.CLOUDBASE_ENV_ID?.trim();
  const accessKey = process.env.CLOUDBASE_APIKEY?.trim();

  if (!env || !accessKey) {
    const error = new Error('CloudBase is not configured.');
    error.name = 'CloudBaseConfigurationError';
    error.status = 503;
    throw error;
  }

  if (!database) {
    const app = cloudbase.init({
      env,
      accessKey,
      region: process.env.CLOUDBASE_REGION || 'ap-shanghai',
    });
    database = app.database();
  }

  return database;
}

async function runDatabaseRequest(operation) {
  try {
    return await operation(getDatabase());
  } catch (cause) {
    if (
      cause.name === 'CloudBaseConfigurationError' ||
      cause.name === 'CloudBaseDatabaseError'
    ) {
      throw cause;
    }

    const error = new Error('CloudBase database request failed.');
    error.name = 'CloudBaseDatabaseError';
    error.status = 503;
    error.code = cause.code || cause.errorCode || 'CLOUD_BASE_REQUEST_FAILED';
    error.requestId = cause.requestId || cause.request_id || null;
    throw error;
  }
}

async function checkConnection() {
  return runDatabaseRequest((db) => db.collection('users').limit(1).get());
}

module.exports = { checkConnection, hasCloudBaseConfig, runDatabaseRequest };
