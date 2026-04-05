document.getElementById('expenseForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('amount').value);
  const description = document.getElementById('description').value;

  try {
    await addExpense({ amount: -amount, description }); // نرسل سالباً
    alert('تم تسجيل المصروف');
    document.getElementById('expenseForm').reset();
    loadExpenses();
  } catch (err) {
    alert('خطأ: ' + err.message);
  }
});

async function loadExpenses() {
  try {
    const movements = await getMovements();
    const expenses = movements.filter(m => m.type === 'EXPENSE');
    const tbody = document.getElementById('expenses-list');
    tbody.innerHTML = '';
    expenses.forEach(e => {
      const row = tbody.insertRow();
      row.insertCell().textContent = -e.amount; // نعرض موجباً
      row.insertCell().textContent = e.description;
      row.insertCell().textContent = new Date(e.createdAt).toLocaleString('ar-EG');
    });
  } catch (err) {
    console.error(err);
  }
}

loadExpenses();