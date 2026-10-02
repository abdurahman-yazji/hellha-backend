const fs = require('node:fs');
const path = require('node:path');

const {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getMessaging } = require('firebase-admin/messaging');
const projectRoot = path.resolve(__dirname, '../..');

const findLocalServiceAccount = () => {
  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const configuredPath = path.resolve(
      projectRoot,
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH
    );

    if (!fs.existsSync(configuredPath)) {
      throw new Error('Configured Firebase service account file was not found');
    }

    return configuredPath;
  }

  const defaultPaths = [
    path.join(projectRoot, 'secrets/firebase-service-account.json'),
    path.join(projectRoot, 'secrets/firebase-service-account.json.json'),
  ];

  return defaultPaths.find((filePath) => fs.existsSync(filePath)) || null;
};

const getCredential = () => {
  const localServiceAccountPath = findLocalServiceAccount();

  if (!localServiceAccountPath) {
    return applicationDefault();
  }

  const serviceAccount = JSON.parse(
    fs.readFileSync(localServiceAccountPath, 'utf8')
  );

  return cert(serviceAccount);
};

if (getApps().length === 0) {
  initializeApp({
    credential: getCredential(),
  });
}

const auth = getAuth();
const messaging = getMessaging();

module.exports = { auth, messaging };