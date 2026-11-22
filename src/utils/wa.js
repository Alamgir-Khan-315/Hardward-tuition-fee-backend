const Setting = require('../models/Setting');

async function val(id, envName) {
  const s = await Setting.findById(id).lean();
  return s ? s.value || '' : process.env[envName] || '';
}

const getWaConfig = async () => ({
  key: await val('waApiKey', 'WHATSAPP_API_KEY'),
  phoneId: await val('waPhoneId', 'WHATSAPP_PHONE_NUMBER_ID'),
});

const mask = (k) => (k ? k.slice(0, 4) + '••••••••' + k.slice(-4) : '');

module.exports = { getWaConfig, mask };
