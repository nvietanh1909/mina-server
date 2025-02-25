// firebase-config.js
const admin = require('firebase-admin');
const path = require('path');

const serviceAccount = require(path.join(__dirname, 'firebase-key', 'FIREBASE_SERVICE_ACCOUNT_KEY'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});


const db = admin.firestore();

module.exports = db;
