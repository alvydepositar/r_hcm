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

const divisionState = {
    options: [],
    lookup: new Map()
};

function loadDivisions() {
    return fetch('/api/divisions/')
        .then(res => {
            if (!res.ok) throw new Error('Failed to load divisions');
            return res.json();
        })
        .then(data => {
            divisionState.options = data.map(d => {
                const value = d.id ?? d.division_id;
                const label = d.division_name ?? d.name ?? `Division ${value}`;
                return { value, label };
            }).filter(d => d.value !== undefined && d.value !== null);
            divisionState.lookup = new Map(divisionState.options.map(o => [String(o.value), o.label]));
        })
        .catch(err => {
            console.error(err);
            divisionState.options = [];
            divisionState.lookup = new Map();
        });
}

function renderDivisionSelect(selectedValue) {
    const options = divisionState.options.length
        ? divisionState.options
        : [{ value: '', label: 'Select division' }];

    return `
        <select class="form-select form-select-sm dt-inline-input">
            ${options.map(o => {
                const isSelected = String(o.value) === String(selectedValue ?? '');
                return `<option value="${o.value}" ${isSelected ? 'selected' : ''}>${o.label}</option>`;
            }).join('')}
        </select>
    `;
}

$(function () {
    // init table after divisions are fetched (still proceeds if fetch fails)
    loadDivisions().finally(() => {
        const table = $('#employees-table').DataTable({
            ajax: {
                url: '/api/employees/',
                dataSrc: ''
            },
            columns: [
                {
                    data: null,
                    orderable: false,
                    defaultContent: '',
                    className: 'select-checkbox',
                    render: function (data, type, row) {
                        return `<input type="checkbox" class="select-row" data-id="${row.id}">`;
                    }
                },
                { data: 'employee_id', className: 'editable' },
                { data: 'first_name', className: 'editable' },
                { data: 'last_name', className: 'editable' },
                { data: 'position', className: 'editable' },
                { data: 'division_name', className: 'editable' },
            ],
            order: [[1, 'asc']]
        });

        // Column configuration: index -> field + editor type
        const columnConfig = {
            1: { field: 'employee_id', type: 'text' },
            2: { field: 'first_name', type: 'text' },
            3: { field: 'last_name', type: 'text' },
            4: { field: 'position', type: 'text' },
            5: { field: 'division', type: 'select' } // FK dropdown
        };

        // Inline editing
        $('#employees-table').on('click', 'tbody td.editable', function () {
            const cell = table.cell(this);
            const colIdx = cell.index().column;
            const config = columnConfig[colIdx];
            if (!config) return;

            const $td = $(this);
            if ($td.hasClass('editing')) return; // avoid double init

            const displayValue = cell.data();
            const rowData = table.row(this.closest('tr')).data();
            const originalEditValue = config.field === 'division'
                ? rowData.division
                : displayValue;

            let isSaving = false;
            let cancelled = false;
            $td.addClass('editing');
            $td.data('original', displayValue);

            if (config.type === 'select') {
                if (!divisionState.options.length) {
                    alert('Divisions not loaded. Please refresh and try again.');
                    return;
                }
                $td.html(renderDivisionSelect(originalEditValue));
            } else {
                $td.html(
                    `<input type="${config.type}"
                            class="form-control form-control-sm dt-inline-input"
                            value="${displayValue ?? ''}">`
                );
            }

            const $input = $td.find('input, select');
            $input.trigger('focus');
            if ($input.is('input')) {
                $input.select();
            }

            function cancelEdit() {
                cancelled = true;
                $input.off('blur');
                $td.removeClass('editing');
                cell.data(displayValue).draw(false);
            }

            function saveEdit() {
                if (isSaving || cancelled) return;
                const newValue = $input.val();
                const payloadValue = config.field === 'division'
                    ? (newValue !== undefined && newValue !== null && newValue !== '' ? parseInt(newValue, 10) : null)
                    : newValue;

                if (config.field === 'division' && (payloadValue === null || Number.isNaN(payloadValue))) {
                    alert('Please select a valid division.');
                    cancelEdit();
                    return;
                }

                // nothing changed
                if (String(payloadValue ?? '') === String(originalEditValue ?? '')) {
                    cancelEdit();
                    return;
                }

                isSaving = true;
                $input.prop('disabled', true);

                fetch(`/api/employees/${rowData.id}/`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRFToken': csrftoken,
                    },
                    body: JSON.stringify({ [config.field]: payloadValue })
                })
                .then(res => {
                    if (res.ok) return res.json();

                    // Try to surface validation errors from the API
                    return res.json()
                        .then(data => {
                            const msg = typeof data === 'object' ? JSON.stringify(data) : data;
                            throw new Error(msg || 'Failed to save');
                        })
                        .catch(() => {
                            throw new Error('Failed to save');
                        });
                })
                .then(updated => {
                    // update row with server response; for division use the FK name
                    const updatedDisplay = config.field === 'division'
                        ? (updated.division_name || divisionState.lookup.get(String(newValue)) || displayValue)
                        : updated[config.field];

                    rowData[config.field] = config.field === 'division' ? updated.division ?? payloadValue : updated[config.field];
                    if (config.field === 'division') {
                        rowData.division_name = updatedDisplay;
                    }

                    // Refresh the full row to keep rowData and display in sync
                    const row = table.row($td.closest('tr'));
                    row.data(rowData).invalidate();
                    cell.data(updatedDisplay);
                    row.draw(false);
                })
                .catch((err) => {
                    alert(`Failed to save. ${err.message || ''}`);
                    cancelEdit();
                })
                .finally(() => {
                    isSaving = false;
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

            // For select, save immediately on change to avoid missing blur events
            if ($input.is('select')) {
                $input.on('change', function () {
                    saveEdit();
                });
            }

            $input.on('blur', function () {
                // auto-save on blur (similar to Editor's inline)
                saveEdit();
            });
        });

        // Add employee modal + handler
        const $addModal = $('#addEmployeeModal');
        const $addForm = $('#add-employee-form');
        const $divisionSelect = $('#add-division');

        if (!$addModal.length || !$addForm.length || !$divisionSelect.length) {
            console.warn('Add employee modal not found in DOM.');
            return;
        }

        const modalEl = $addModal[0];
        const bootstrapModal = typeof bootstrap !== 'undefined'
            ? new bootstrap.Modal(modalEl)
            : null;

        function populateDivisionSelect() {
            if (!divisionState.options.length) {
                alert('Divisions not loaded. Please refresh and try again.');
                return false;
            }
            const opts = ['<option value="">Select division</option>'].concat(
                divisionState.options.map(o => `<option value="${o.value}">${o.label}</option>`)
            );
            $divisionSelect.html(opts.join(''));
            return true;
        }

        $('#add-employee-btn').on('click', function () {
            if (!populateDivisionSelect()) return;
            $addForm[0].reset();
            if (bootstrapModal) {
                bootstrapModal.show();
            } else {
                $addModal.show(); // basic fallback
            }
        });

        $addForm.on('submit', function (e) {
            e.preventDefault();
            const payload = {
                employee_id: $('#add-employee-id').val().trim(),
                first_name: $('#add-first-name').val().trim(),
                last_name: $('#add-last-name').val().trim(),
                position: $('#add-position').val().trim(),
                division: parseInt($divisionSelect.val(), 10)
            };

            if (!payload.employee_id || !payload.first_name || !payload.last_name || !payload.position || Number.isNaN(payload.division)) {
                alert('Please complete all required fields.');
                return;
            }

            fetch('/api/employees/', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                body: JSON.stringify(payload)
            })
            .then(res => {
                if (res.ok) return res.json();
                return res.json()
                    .then(data => {
                        const msg = typeof data === 'object' ? JSON.stringify(data) : data;
                        throw new Error(msg || 'Failed to save');
                    })
                    .catch(() => { throw new Error('Failed to save'); });
            })
            .then(() => {
                if (bootstrapModal) {
                    bootstrapModal.hide();
                } else {
                    $addModal.hide();
                }
                table.ajax.reload(null, false);
            })
            .catch(err => {
                alert(`Failed to add employee. ${err.message || ''}`);
            });
        });
    });
});
