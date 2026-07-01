// Property Management Portal - Main JavaScript

document.addEventListener('DOMContentLoaded', function() {
  // Auto-dismiss alerts after 5 seconds
  const alerts = document.querySelectorAll('.alert');
  alerts.forEach(alert => {
    setTimeout(() => {
      const bsAlert = new bootstrap.Alert(alert);
      bsAlert.close();
    }, 5000);
  });

  // Confirm delete actions
  document.querySelectorAll('form[onsubmit]').forEach(form => {
    form.addEventListener('submit', function(e) {
      if (!confirm(this.getAttribute('onsubmit').replace('return confirm('', '').replace('');', ''))) {
        e.preventDefault();
      }
    });
  });

  // Table sorting
  document.querySelectorAll('th').forEach(th => {
    th.style.cursor = 'pointer';
    th.addEventListener('click', function() {
      const table = th.closest('table');
      const tbody = table.querySelector('tbody');
      const rows = Array.from(tbody.querySelectorAll('tr'));
      const index = Array.from(th.parentNode.children).indexOf(th);
      const isAsc = !th.classList.contains('asc');

      rows.sort((a, b) => {
        const aVal = a.children[index].textContent.trim();
        const bVal = b.children[index].textContent.trim();
        return isAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      });

      rows.forEach(row => tbody.appendChild(row));

      table.querySelectorAll('th').forEach(h => h.classList.remove('asc', 'desc'));
      th.classList.add(isAsc ? 'asc' : 'desc');
    });
  });
});

// Format currency
function formatCurrency(amount) {
  return '\u20b9' + parseFloat(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

// Format date
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}
