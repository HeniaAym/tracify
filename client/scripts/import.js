document.getElementById('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const fileInput = document.getElementById('file');
  if (!fileInput.files[0]) return;

  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML = '<p>جاري المعالجة...</p>';

  try {
    const data = await uploadExcel(fileInput.files[0]);
    resultDiv.innerHTML = `
      <div class="alert success">
        <p>تم بنجاح: ${data.inserted} طرد من أصل ${data.totalRows}</p>
        ${data.errors.length ? '<p>الأخطاء:</p><ul>' + data.errors.map(e => '<li>' + e + '</li>').join('') + '</ul>' : ''}
      </div>
    `;
  } catch (err) {
    resultDiv.innerHTML = `<div class="alert">${err.message}</div>`;
  }
});