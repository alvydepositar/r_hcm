$(function () {
    const table = $('#time-rules-table').DataTable({
        ajax: {
            url: '/api/time_rules/',
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
            { data: 'time_rule_id'},
            { data: 'time_rule_name', className: 'editable' },
            { data: 'earliest_in', className: 'editable' },
            { data: 'latest_in', className: 'editable' },
            { data: 'earliest_out', className: 'editable' },
            { data: 'latest_out', className: 'editable' },
            { data: 'lunch_start', className: 'editable' },
            { data: 'lunch_end', className: 'editable' },
            { data: 'lunch_grace_period', className: 'editable' }
        ],
        order: [[1, 'asc']]
    });

    // Column configuration: index -> field + editor type
    const columnConfig = {
        1: { field: 'time_rule_id', type: 'number' },
        2: { field: 'time_rule_name', type: 'text' },
        3: { field: 'earliest_in', type: 'text' },
        4: { field: 'latest_in', type: 'text' },
        5: { field: 'earliest_out', type: 'text' },
        6: { field: 'latest_out', type: 'text' },
        7: { field: 'lunch_start', type: 'text' },
        8: { field: 'lunch_end', type: 'text' },
        9: { field: 'lunch_grace_period', type: 'number' }
    };

    // Inline editing
    $('#time-rules-table').on('click', 'tbody td.editable', function () {
        const cell = table.cell(this);
        const colIdx = cell.index().column;
        const config = columnConfig[colIdx];
        if (!config) return;

        const $td = $(this);
        if ($td.hasClass('editing')) return;

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

            fetch(`/api/time_rules/${rowData.time_rule_id}/`, {
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

    // Add time rule modal + handler
    const $addModal = $('#addTimeRuleModal');
    const $addForm = $('#add-time-rule-form');

    if (!$addModal.length || !$addForm.length) {
        console.warn('Add time rule modal not found in DOM.');
        return;
    }

    const modalEl = $addModal[0];
    const bootstrapModal = typeof bootstrap !== 'undefined'
        ? new bootstrap.Modal(modalEl)
        : null;

    $('#add-time-rule-btn').on('click', function () {
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
            time_rule_name: $('#add-time-rule-name').val().trim(),
            earliest_in: $('#add-earliest-in').val().trim(),
            latest_in: $('#add-latest-in').val().trim(),
            earliest_out: $('#add-earliest-out').val().trim(),
            latest_out: $('#add-latest-out').val().trim(),
            lunch_start: $('#add-lunch-start').val().trim(),
            lunch_end: $('#add-lunch-end').val().trim(),
            lunch_grace_period: $('#add-lunch-grace-period').val().trim(),
        };

        if (!payload.time_rule_name || 
            !payload.earliest_in || !payload.latest_in ||
            !payload.earliest_out || !payload.latest_out ||
            !payload.lunch_start || !payload.lunch_end ||
            !payload.lunch_grace_period) {
            alert('Please complete all required fields.');
            return;
        }

        fetch('/api/time_rules/', {
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
            alert(`Failed to add position. ${err.message || ''}`);
        });
    });
});