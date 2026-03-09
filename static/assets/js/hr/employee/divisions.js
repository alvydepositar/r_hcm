$(function () {
    const table = $('#divisions-table').DataTable({
        ajax: {
            url: '/api/divisions/',
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
            { data: 'division_id'},
            { data: 'division_name', className: 'editable' },
            { data: 'division_abbreviation', className: 'editable' }
        ],
        order: [[1, 'asc']]
    });

    // Column configuration: index -> field + editor type
    const columnConfig = {
        1: { field: 'division_id', type: 'number' },
        2: { field: 'division_name', type: 'text' },
        3: { field: 'division_abbreviation', type: 'text' }
    };

    // Inline editing
    $('#divisions-table').on('click', 'tbody td.editable', function () {
        const cell = table.cell(this);
        const colIdx = cell.index().column;
        const config = columnConfig[colIdx];
        if (!config) return;

        const $td = $(this);
        if ($td.hasClass('editing')) return; // avoid double init

        const displayValue = cell.data();
        const rowData = table.row(this.closest('tr')).data();
        const originalEditValue = displayValue;

        let isSaving = false;
        let cancelled = false;
        $td.addClass('editing');
        $td.data('original', displayValue);

        // Create input element
        const inputType = config.type === 'number' ? 'number' : 'text';
        $td.html(`<input type="${inputType}" value="${displayValue}" size="${displayValue.length + 2}">`);
        const $input = $td.find('input');
        $input.focus().select();

        function cancelEdit() {
            cancelled = true;
            $input.off('blur');
            $td.removeClass('editing');
            $td.text(displayValue);
        }

        function saveEdit() {
            if (isSaving || cancelled) return;
            const newValue = $input.val();
            
            // nothing changed
            if (String(newValue ?? '') === String(originalEditValue ?? '')) {
                cancelEdit();
                return;
            }

            isSaving = true;
            $input.prop('disabled', true);

            fetch(`/api/divisions/${rowData.division_id}/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': csrftoken,
                },
                body: JSON.stringify({ [config.field]: newValue })
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
                // update row with server response
                const updatedDisplay = updated[config.field];

                rowData[config.field] = updated[config.field];

                // Update the cell display
                $td.text(updatedDisplay);
                $td.removeClass('editing');

                // Refresh the row data
                table.row($td.closest('tr')).data(rowData);
            })
            .catch((err) => {
                alert(`Failed to save. ${err.message || ''}`);
                cancelEdit();
            })
            .finally(() => {
                isSaving = false;
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
            // auto-save on blur
            saveEdit();
        });
    });

    // Add division modal + handler
    const $addModal = $('#addDivisionModal');
    const $addForm = $('#add-division-form');

    if (!$addModal.length || !$addForm.length) {
        console.warn('Add division modal not found in DOM.');
        return;
    }

    const modalEl = $addModal[0];
    const bootstrapModal = typeof bootstrap !== 'undefined'
        ? new bootstrap.Modal(modalEl)
        : null;

    $('#add-division-btn').on('click', function () {
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
            division_name: $('#add-division-name').val().trim(),
            division_abbreviation: $('#add-abbreviation').val().trim()
        };

        if (!payload.division_name || !payload.division_abbreviation) {
            alert('Please complete all required fields.');
            return;
        }

        fetch('/api/divisions/', {
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
            alert(`Failed to add division. ${err.message || ''}`);
        });
    });
});