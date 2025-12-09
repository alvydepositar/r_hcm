// Simple helper for CSRF (Django)
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}
const csrftoken = getCookie('csrftoken');

$(function () {
    const table = $('#employees-table').DataTable({
        ajax: {
            url: '/hr/api/employees/',
            dataSrc: ''
        },
        columns: [
            {
                data: null,
                orderable: false,
                defaultContent: '',
                className: 'select-checkbox',
                render: function(data, type, row) {
                    return `<input type="checkbox" class="select-row" data-id="${row.employee_id}">`;
                }
            },
            { data: 'employee_id', className: 'editable' },
            { data: 'first_name',  className: 'editable' },
            { data: 'last_name',   className: 'editable' },
            { data: 'position',    className: 'editable' },
            { data: 'division',    className: 'editable' },
        ],
        order: [[1, 'asc']]
    });

    // Map column index -> field name (must match JSON / Django fields)
    const fieldMap = {
        1: 'id',
        2: 'employee_id',
        3: 'first_name',
        4: 'last_name',
        5: 'position',
        6: 'division'
    };

    // Inline editing
    $('#employees-table').on('click', 'tbody td.editable', function () {
        const cell = table.cell(this);
        const colIdx = cell.index().column;
        const field = fieldMap[colIdx];
        if (!field) return;

        const $td = $(this);
        if ($td.hasClass('editing')) return; // avoid double init

        const originalValue = cell.data();
        const rowData = table.row(this.closest('tr')).data();

        $td.addClass('editing');
        $td.data('original', originalValue);

        const inputType = field === 'salary' ? 'number' : 'text'; // keep for later if you add salary
        $td.html(
            `<input type="${inputType}" 
                    class="form-control form-control-sm dt-inline-input" 
                    value="${originalValue ?? ''}">`
        );

        const $input = $td.find('input');
        $input.trigger('focus').select();

        function cancelEdit() {
            $td.removeClass('editing');
            cell.data(originalValue).draw(false);
        }

        function saveEdit() {
            const newValue = $input.val();

            // nothing changed
            if (newValue === originalValue) {
                cancelEdit();
                return;
            }

            fetch(`/hr/api/employees/${rowData.employee_id}/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                body: JSON.stringify({ [field]: newValue })
            })
            .then(res => {
                if (!res.ok) throw new Error('Failed to save');
                return res.json();
            })
            .then(updated => {
                // update row with server response
                cell.data(updated[field]).draw(false);
            })
            .catch(err => {
                alert('Failed to save. Please try again.');
                cancelEdit();
            })
            .finally(() => {
                $td.removeClass('editing');
            });
        }

        $input.on('keydown', function (e) {
            if (e.key === 'Enter') {
                e.preventDefault();
                saveEdit();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                cancelEdit();
            }
        });

        $input.on('blur', function () {
            // auto-save on blur (similar to Editor’s inline)
            saveEdit();
        });
    });
});
