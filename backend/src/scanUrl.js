// Link encoded in every QR code: <QR_BASE_URL>/<secret code>
const baseUrl = () => (process.env.QR_BASE_URL || 'https://infisetu.com').replace(/\/+$/, '');

const scanUrl = (code) => `${baseUrl()}/${code}`;

module.exports = { scanUrl };
