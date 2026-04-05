const mongoose = require('mongoose');
const CashClosing = require('../models/CashClosing');
const DriverSettlement = require('../models/DriverSettlement');

const UsedNumbers = new Set();
let initialized = false;

async function loadExistingNumbers() {
  if (initialized) return;
  const [closings, settlements] = await Promise.all([
    CashClosing.find({}, { receiptNumber: 1 }),
    DriverSettlement.find({}, { settlementNumber: 1 })
  ]);
  closings.forEach(doc => { if (doc.receiptNumber) UsedNumbers.add(doc.receiptNumber); });
  settlements.forEach(doc => { if (doc.settlementNumber) UsedNumbers.add(doc.settlementNumber); });
  initialized = true;
}

async function generateReceiptNumber() {
  await loadExistingNumbers();
  let number;
  do {
    const digits = Math.floor(100000 + Math.random() * 900000);
    number = `COLL-${digits}`;
  } while (UsedNumbers.has(number));
  UsedNumbers.add(number);
  // persist immediately
  return number;
}

module.exports = { generateReceiptNumber };
