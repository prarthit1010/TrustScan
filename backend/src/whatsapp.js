// Sends login codes through the WhatsApp Cloud API (Meta).
// The template must be an approved "Authentication" template with a copy-code button.

const isWhatsappConfigured = () => Boolean(
  process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_TEMPLATE_NAME
);

// mobile: 10-digit Indian number
async function sendWhatsappOtp(mobile, code) {
  const version = process.env.WHATSAPP_API_VERSION || 'v23.0';
  const response = await fetch(`https://graph.facebook.com/${version}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: `91${mobile}`,
      type: 'template',
      template: {
        name: process.env.WHATSAPP_TEMPLATE_NAME,
        language: { code: process.env.WHATSAPP_TEMPLATE_LANGUAGE || 'en' },
        components: [
          { type: 'body', parameters: [{ type: 'text', text: code }] },
          { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: code }] },
        ],
      },
    }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error(`WhatsApp API ${response.status}: ${await response.text()}`);
}

module.exports = { isWhatsappConfigured, sendWhatsappOtp };
