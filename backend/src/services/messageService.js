function inr(amount) {
  return `Rs.${Number(amount || 0).toLocaleString('en-IN')}`;
}

const TEMPLATES = {
  payment_failed: {
    en: (c) => `Hi ${c.name}, your ${inr(c.amount)} payment could not be completed. You can retry securely at your convenience.`,
    hinglish: (c) => `Hi ${c.name}, aapka ${inr(c.amount)} payment complete nahi ho paya. Aap suvidha anusar dobara prayas kar sakte hain.`
  },
  payment_link: {
    en: (c) => `Hi ${c.name}, your ${inr(c.amount)} payment is pending. Complete it securely here: ${c.link}.`,
    hinglish: (c) => `Hi ${c.name}, aapka ${inr(c.amount)} payment pending hai. Aap secure payment link se payment complete kar sakte hain: ${c.link}.`
  },
  reminder: {
    en: (c) => `Hi ${c.name}, a friendly reminder that your ${inr(c.amount)} payment is still pending.`,
    hinglish: (c) => `Hi ${c.name}, yaad dilana tha ki aapka ${inr(c.amount)} payment abhi pending hai.`
  },
  retry: {
    en: (c) => `Hi ${c.name}, we will retry your ${inr(c.amount)} payment shortly. No action needed.`,
    hinglish: (c) => `Hi ${c.name}, hum aapka ${inr(c.amount)} payment jald dobara try karenge. Aapko kuch karne ki zaroorat nahi.`
  },
  insufficient_funds: {
    en: (c) => `Hi ${c.name}, your ${inr(c.amount)} payment failed due to insufficient funds. Please retry after ensuring balance.`,
    hinglish: (c) => `Hi ${c.name}, aapka ${inr(c.amount)} payment insufficient funds ki wajah se fail hua. Balance sunishchit karke dobara prayas karein.`
  },
  escalation: {
    en: (c) => `Hi ${c.name}, your ${inr(c.amount)} payment needs attention. Our support team will contact you shortly.`,
    hinglish: (c) => `Hi ${c.name}, aapke ${inr(c.amount)} payment par dhyan dene ki zaroorat hai. Hamari support team jald sampark karegi.`
  }
};

function scenarioFor({ action, failureReason }) {
  if (action === 'escalate') return 'escalation';
  if (action === 'payment_link') return 'payment_link';
  if (action === 'reminder') return 'reminder';
  if (action === 'retry' || action === 'retry_later') {
    return failureReason === 'insufficient_funds' ? 'insufficient_funds' : 'retry';
  }
  if (failureReason === 'insufficient_funds') return 'insufficient_funds';
  return 'payment_failed';
}

function generateMessage({ customerName = 'Customer', amount = 0, channel = 'email', action = 'retry', failureReason = 'unknown', language = 'hinglish', paymentLink = 'https://pay.example.com/link' } = {}) {
  const lang = language === 'en' ? 'en' : 'hinglish';
  const scenario = scenarioFor({ action, failureReason });
  const template = (TEMPLATES[scenario] || TEMPLATES.payment_failed)[lang];
  const message = template({ name: customerName, amount, link: paymentLink });
  return {
    language: lang,
    channel,
    message,
    reason: `${scenario} template in ${lang} for ${channel}, generated from actual case values (name, ${inr(amount)}, action ${action}). Simulated only — message is not sent.`
  };
}

module.exports = { generateMessage, scenarioFor, TEMPLATES };
