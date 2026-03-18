const yearSelect = document.getElementById('year-select');
const yearsCount = document.getElementById('years-count');
const status = document.getElementById('load-status');

async function loadYears() {
  try {
    const res = await fetch('/years');
    if (!res.ok) throw new Error(`Server returned ${res.status}`);
    const years = await res.json();
    if (!Array.isArray(years) || years.length === 0) {
      yearSelect.innerHTML = '<option>No years available</option>';
      status.textContent = 'No seasons were found in the database.';
      return;
    }

    yearSelect.innerHTML = years.map((year) => `<option value="${year}">${year}</option>`).join('');
    yearsCount.textContent = `${years.length}`;
    status.textContent = `Loaded ${years.length} seasons from the API.`;
  } catch (error) {
    console.error(error);
    yearSelect.innerHTML = '<option>Error loading data</option>';
    yearsCount.textContent = '0';
    status.textContent = 'Could not load years. Check the backend and retry.';
  }
}

window.addEventListener('DOMContentLoaded', loadYears);
