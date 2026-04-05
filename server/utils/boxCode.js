const LETTERS = 'abcdefghijklmnopqrstuvwxyz';

async function generateBoxCode(MoneyBox) {
  let code;
  let exists = true;
  while (exists) {
    const letters = Array.from({ length: 3 }, () =>
      LETTERS[Math.floor(Math.random() * 26)]
    ).join('');
    const digits = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
    code = `mb-${letters}${digits}`;
    exists = await MoneyBox.exists({ boxCode: code });
  }
  return code;
}

module.exports = { generateBoxCode };