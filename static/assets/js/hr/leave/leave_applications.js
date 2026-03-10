const leaveApplicationStatusOptions = [
    { value: "submitted", label: "Submitted" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "cancelled", label: "Cancelled" },
];

const leaveApplicationStatusLookup = new Map(
    leaveApplicationStatusOptions.map(option => [option.value, option.label]),
);
const leaveApplicationViewFields = [
    {
        label: "Employee",
        field: "employee",
        format: ({ value, rowData }) => formatEmployeeReference(value) || rowData.employee_name || "",
    },
    {
        label: "Leave Type",
        field: "leave_type",
        format: ({ value, rowData }) => formatLeaveTypeReference(value) || rowData.leave_type_name || "",
    },
    { label: "Start Date", field: "start_date" },
    { label: "End Date", field: "end_date" },
    {
        label: "Requested Units",
        field: "requested_units",
        format: ({ value }) => formatLeaveApplicationUnits(value),
    },
    {
        label: "Status",
        field: "status",
        format: ({ value, rowData }) => leaveApplicationStatusLookup.get(value) || rowData.status_label || "",
    },
    { label: "Rule Summary", field: "leave_rule_summary", fullWidth: true },
    { label: "Balance Bucket", field: "balance_bucket_code" },
    {
        label: "Available Balance",
        field: "available_balance",
        format: ({ value }) => formatLeaveApplicationUnits(value),
    },
    { label: "Document Reference", field: "supporting_document_reference" },
    { label: "Reason", field: "reason", fullWidth: true },
    { label: "Document / HR Notes", field: "supporting_document_notes", fullWidth: true },
    { label: "Approved At", field: "approved_at" },
];

const leaveApplicationCreditState = {
    records: [],
    lookup: new Map(),
};

function parseNullableDecimal(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const parsed = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ""));
    return Number.isNaN(parsed) ? null : parsed.toFixed(2);
}

function formatLeaveApplicationUnits(value) {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? value || "" : parsed.toFixed(2);
}

function loadLeaveCreditBalances() {
    return fetch("/api/leave-credits/")
        .then(res => {
            if (!res.ok) throw new Error("Failed to load leave credit balances");
            return res.json();
        })
        .then(data => {
            leaveApplicationCreditState.records = data;
            leaveApplicationCreditState.lookup = new Map(
                data.map(record => [
                    `${record.employee}:${record.bucket_code}`,
                    record,
                ]),
            );
        });
}

function resolveLeaveTypeBucket(record) {
    if (!record) {
        return null;
    }

    if (record.balance_tracking_mode === "vacation") {
        return { bucketCode: "vacation", bucketName: "Vacation Leave Credits" };
    }

    if (record.balance_tracking_mode === "sick") {
        return { bucketCode: "sick", bucketName: "Sick Leave Credits" };
    }

    if (record.balance_tracking_mode === "leave_type") {
        return { bucketCode: record.leave_code, bucketName: record.leave_name };
    }

    return null;
}

function getLeaveApplicationAvailableBalance(employeeValue, leaveTypeValue) {
    const employeeId = resolveEmployeeReference(employeeValue);
    const leaveTypeRecord = getLeaveTypeRecord(leaveTypeValue);
    const bucket = resolveLeaveTypeBucket(leaveTypeRecord);

    if (!employeeId || !bucket) {
        return null;
    }

    return leaveApplicationCreditState.lookup.get(`${employeeId}:${bucket.bucketCode}`) || null;
}

function calculateRequestedUnits(leaveTypeRecord, startDateValue, endDateValue, manualValue) {
    if (!leaveTypeRecord || !startDateValue || !endDateValue) {
        return manualValue || "";
    }

    const startDate = new Date(`${startDateValue}T00:00:00`);
    const endDate = new Date(`${endDateValue}T00:00:00`);

    if (Number.isNaN(startDate.valueOf()) || Number.isNaN(endDate.valueOf()) || endDate < startDate) {
        return manualValue || "";
    }

    let workingDays = 0;
    let calendarDays = 0;
    const currentDate = new Date(startDate);

    while (currentDate <= endDate) {
        calendarDays += 1;

        if (![0, 6].includes(currentDate.getDay())) {
            workingDays += 1;
        }

        currentDate.setDate(currentDate.getDate() + 1);
    }

    if (leaveTypeRecord.entitlement_unit === "calendar_days") {
        return calendarDays.toFixed(2);
    }

    if (
        leaveTypeRecord.entitlement_unit === "working_days"
        || leaveTypeRecord.entitlement_unit === "credit_balance"
    ) {
        return workingDays.toFixed(2);
    }

    return manualValue || "";
}

function isManualRequestedUnitsLeaveType(leaveTypeRecord) {
    return !!leaveTypeRecord && leaveTypeRecord.entitlement_unit === "months";
}

function buildLeaveApplicationDisplayRow(rowData) {
    const availableCredit = getLeaveApplicationAvailableBalance(rowData.employee, rowData.leave_type);
    return {
        ...rowData,
        available_balance: rowData.available_balance ?? availableCredit?.current_balance ?? null,
        leave_rule_summary: rowData.entitlement_summary || "",
    };
}

Promise.all([loadEmployees(), loadLeaveTypes(), loadLeaveCreditBalances()])
    .then(() => {
        const leaveApplicationRowEditor = createTableRowEditor({
            primaryKey: "leave_application_id",
            editableFields: [
                "employee",
                "leave_type",
                "start_date",
                "end_date",
                "requested_units",
                "status",
                "reason",
                "supporting_document_reference",
                "supporting_document_notes",
            ],
            viewFields: leaveApplicationViewFields,
            getViewTitle: rowData => `Leave Application: ${rowData.employee_name || formatEmployeeReference(rowData.employee)}`,
            getViewSubtitle: rowData => rowData.leave_type_name || formatLeaveTypeReference(rowData.leave_type),
            patchUrlBase: "/api/leave-applications/",
            deleteUrlBase: "/api/leave-applications/",
            deleteConfirmMessage: "Delete this leave application?",
            bulkDeleteConfirmMessage: "Delete the selected leave applications?",
            prepareModalRowData: rowData => {
                const leaveTypeRecord = getLeaveTypeRecord(rowData.leave_type);
                return buildLeaveApplicationDisplayRow({
                    ...rowData,
                    requested_units: calculateRequestedUnits(
                        leaveTypeRecord,
                        rowData.start_date,
                        rowData.end_date,
                        rowData.requested_units,
                    ),
                });
            },
            isModalFieldEditable: ({ field, rowData }) => {
                if (field === "requested_units") {
                    return isManualRequestedUnitsLeaveType(getLeaveTypeRecord(rowData.leave_type));
                }

                return true;
            },
            serializeFieldValue: ({ field, value }) => {
                if (field === "employee") {
                    return resolveEmployeeReference(value);
                }

                if (field === "leave_type") {
                    return resolveLeaveTypeReference(value);
                }

                if (field === "requested_units") {
                    return parseNullableDecimal(value);
                }

                return value === "" ? null : value;
            },
            onSaveSuccess: ({ row, updated }) => {
                row.update(buildLeaveApplicationDisplayRow(updated));
                loadLeaveCreditBalances().catch(err => console.error("Failed to refresh leave balances:", err));
            },
            onDeleteSuccess: () => {
                loadLeaveCreditBalances().catch(err => console.error("Failed to refresh leave balances:", err));
            },
        });

        const leaveApplicationFactory = new tableFactory({
            el: "#leave-applications-table",
            api: {
                list: "/api/leave-applications/",
                detail: "/api/leave-applications/",
            },
            primaryKey: "leave_application_id",
            autoSaveEdits: false,
            layout: "fitDataStretch",
            tableHeight: "560px",
            ajaxResponse: (url, params, response) => response.map(row => buildLeaveApplicationDisplayRow(row)),
            onCellEdited: cell => {
                const rowData = cell.getRow().getData();
                const leaveTypeRecord = getLeaveTypeRecord(rowData.leave_type);

                if (["leave_type", "start_date", "end_date", "requested_units"].includes(cell.getField())) {
                    const updatedRow = {
                        ...rowData,
                        requested_units: calculateRequestedUnits(
                            leaveTypeRecord,
                            rowData.start_date,
                            rowData.end_date,
                            rowData.requested_units,
                        ),
                    };
                    cell.getRow().update(buildLeaveApplicationDisplayRow(updatedRow));
                }
            },
            columns: [
                {
                    formatter: "rowSelection",
                    titleFormatter: "rowSelection",
                    hozAlign: "left",
                    headerSort: false,
                    width: 50,
                    frozen: true,
                },
                {
                    title: "Employee",
                    field: "employee",
                    editor: searchableDropdownEditor,
                    editorParams: () => buildSearchableListEditorParams(employeeState.options, {
                        placeholder: "Select employee",
                        searchPlaceholder: "Search employees",
                        searchCategory: "person",
                    }),
                    editable: cell => leaveApplicationRowEditor.isEditingRow(cell.getRow().getData()),
                    formatter: cell => formatEmployeeReference(cell.getValue()) || cell.getRow().getData().employee_name || "",
                    headerSort: true,
                    width: 230,
                    frozen: true,
                },
                {
                    title: "Leave Type",
                    field: "leave_type",
                    editor: searchableDropdownEditor,
                    editorParams: () => buildSearchableListEditorParams(leaveTypeState.options, {
                        placeholder: "Select leave type",
                        searchPlaceholder: "Search leave types",
                    }),
                    editable: cell => leaveApplicationRowEditor.isEditingRow(cell.getRow().getData()),
                    formatter: cell => formatLeaveTypeReference(cell.getValue()) || cell.getRow().getData().leave_type_name || "",
                    headerSort: true,
                    width: 240,
                    frozen: true,
                },
                {
                    title: "Start Date",
                    field: "start_date",
                    editor: "input",
                    editable: cell => leaveApplicationRowEditor.isEditingRow(cell.getRow().getData()),
                    headerSort: true,
                    width: 130,
                },
                {
                    title: "End Date",
                    field: "end_date",
                    editor: "input",
                    editable: cell => leaveApplicationRowEditor.isEditingRow(cell.getRow().getData()),
                    headerSort: true,
                    width: 130,
                },
                {
                    title: "Requested Units",
                    field: "requested_units",
                    editor: "input",
                    editable: cell => {
                        if (!leaveApplicationRowEditor.isEditingRow(cell.getRow().getData())) {
                            return false;
                        }

                        return isManualRequestedUnitsLeaveType(
                            getLeaveTypeRecord(cell.getRow().getData().leave_type),
                        );
                    },
                    formatter: cell => formatLeaveApplicationUnits(cell.getValue()),
                    hozAlign: "right",
                    headerSort: true,
                    width: 140,
                },
                {
                    title: "Status",
                    field: "status",
                    editor: searchableDropdownEditor,
                    editorParams: () => buildSearchableListEditorParams(leaveApplicationStatusOptions, {
                        placeholder: "Select status",
                        searchPlaceholder: "Search statuses",
                    }),
                    editable: cell => leaveApplicationRowEditor.isEditingRow(cell.getRow().getData()),
                    formatter: cell => leaveApplicationStatusLookup.get(cell.getValue()) || cell.getRow().getData().status_label || "",
                    headerSort: true,
                    width: 130,
                },
                {
                    title: "Available Balance",
                    field: "available_balance",
                    formatter: cell => cell.getValue() ? formatLeaveApplicationUnits(cell.getValue()) : "",
                    hozAlign: "right",
                    headerSort: true,
                    width: 140,
                },
                {
                    title: "Document Reference",
                    field: "supporting_document_reference",
                    editor: "input",
                    editable: cell => leaveApplicationRowEditor.isEditingRow(cell.getRow().getData()),
                    headerSort: true,
                    width: 210,
                },
                {
                    title: "Reason",
                    field: "reason",
                    editor: "textarea",
                    editable: cell => leaveApplicationRowEditor.isEditingRow(cell.getRow().getData()),
                    formatter: "textarea",
                    headerSort: true,
                    width: 260,
                },
                {
                    title: "Document / HR Notes",
                    field: "supporting_document_notes",
                    editor: "textarea",
                    editable: cell => leaveApplicationRowEditor.isEditingRow(cell.getRow().getData()),
                    formatter: "textarea",
                    headerSort: true,
                    width: 260,
                },
                leaveApplicationRowEditor.buildActionsColumn({ width: 190 }),
            ],
        });

        const leaveApplicationTable = leaveApplicationFactory.create();
        leaveApplicationRowEditor.attachTable(leaveApplicationTable);
        bindTableSearchInput("table-search", leaveApplicationFactory);
        bindBulkEditActionButtons(leaveApplicationRowEditor, {
            editAllButton: document.getElementById("edit-all-leave-applications-btn"),
            saveAllButton: document.getElementById("save-all-leave-applications-btn"),
            cancelAllButton: document.getElementById("cancel-all-leave-applications-btn"),
        });
        bindSelectionActionButton(
            leaveApplicationTable,
            document.getElementById("delete-selected-leave-applications-btn"),
        );

        const leaveApplicationModalElement = document.getElementById("addLeaveApplicationModal");
        const leaveApplicationModal = new bootstrap.Modal(leaveApplicationModalElement);
        const leaveApplicationForm = document.getElementById("add-leave-application-form");

        const employeeSelect = document.getElementById("add-application-employee");
        const leaveTypeSelect = document.getElementById("add-application-leave-type");
        const statusSelect = document.getElementById("add-application-status");
        const startDateInput = document.getElementById("add-application-start-date");
        const endDateInput = document.getElementById("add-application-end-date");
        const requestedUnitsInput = document.getElementById("add-application-requested-units");
        const documentReferenceInput = document.getElementById("add-application-document-reference");
        const reasonInput = document.getElementById("add-application-reason");
        const documentNotesInput = document.getElementById("add-application-document-notes");

        const ruleSummary = document.getElementById("leave-rule-summary");
        const ruleBucket = document.getElementById("leave-rule-bucket");
        const ruleBalance = document.getElementById("leave-rule-balance");
        const ruleNotice = document.getElementById("leave-rule-notice");
        const ruleMaxDays = document.getElementById("leave-rule-max-days");
        const ruleDocs = document.getElementById("leave-rule-docs");

        employeeSelect.dataset.searchCategory = "person";
        initializeSearchableSelects(leaveApplicationModalElement, {
            selector: "select",
            searchPlaceholder: "Search records",
        });

        function syncLeaveApplicationForm() {
            const leaveTypeRecord = getLeaveTypeRecord(leaveTypeSelect.value);
            const availableCredit = getLeaveApplicationAvailableBalance(employeeSelect.value, leaveTypeSelect.value);
            const balanceBucket = resolveLeaveTypeBucket(leaveTypeRecord);

            ruleSummary.textContent = leaveTypeRecord?.entitlement_summary || "Select a leave type to view the applicable CSC rule.";
            ruleBucket.textContent = balanceBucket?.bucketName || "Not tracked";
            ruleBalance.textContent = availableCredit?.current_balance || "N/A";
            ruleNotice.textContent = leaveTypeRecord?.advance_notice_days
                ? `${leaveTypeRecord.advance_notice_days} day(s)`
                : "None";
            ruleMaxDays.textContent = leaveTypeRecord?.max_consecutive_days || "None";
            ruleDocs.textContent = leaveTypeRecord?.requires_supporting_document
                ? (leaveTypeRecord.supporting_document_notes || "Required")
                : "Not required";

            const manualUnits = isManualRequestedUnitsLeaveType(leaveTypeRecord);
            requestedUnitsInput.disabled = !manualUnits;
            requestedUnitsInput.required = manualUnits;

            if (!manualUnits) {
                requestedUnitsInput.value = calculateRequestedUnits(
                    leaveTypeRecord,
                    startDateInput.value,
                    endDateInput.value,
                    requestedUnitsInput.value,
                );
            }

            documentReferenceInput.required = !!leaveTypeRecord?.requires_supporting_document;
        }

        function populateLeaveApplicationModalOptions() {
            populateLookupSelect(employeeSelect, employeeState.options, "Select employee");
            populateLookupSelect(
                leaveTypeSelect,
                Array.from(leaveTypeState.records.values())
                    .filter(record => record.is_active && record.category !== "conversion")
                    .map(record => ({
                        value: record.leave_type_id,
                        label: record.leave_name,
                    })),
                "Select leave type",
            );
            refreshSearchableSelect(employeeSelect);
            refreshSearchableSelect(leaveTypeSelect);
            refreshSearchableSelect(statusSelect);
        }

        document.getElementById("add-leave-application-btn").addEventListener("click", () => {
            if (!employeeState.options.length || !leaveTypeState.options.length) {
                alert("Employee and leave-type records are required before filing leave.");
                return;
            }

            leaveApplicationForm.reset();
            populateLeaveApplicationModalOptions();
            statusSelect.value = "submitted";
            refreshSearchableSelect(statusSelect);
            syncLeaveApplicationForm();
            leaveApplicationModal.show();
        });

        [employeeSelect, leaveTypeSelect, statusSelect, startDateInput, endDateInput].forEach(element => {
            element.addEventListener("change", syncLeaveApplicationForm);
        });

        document.getElementById("delete-selected-leave-applications-btn").addEventListener("click", () => {
            leaveApplicationRowEditor.deleteSelectedRows({
                emptySelectionMessage: "Select at least one leave application to delete.",
            });
        });

        leaveApplicationForm.addEventListener("submit", async event => {
            event.preventDefault();

            const leaveTypeRecord = getLeaveTypeRecord(leaveTypeSelect.value);
            const payload = {
                employee: resolveEmployeeReference(employeeSelect.value),
                leave_type: resolveLeaveTypeReference(leaveTypeSelect.value),
                start_date: startDateInput.value,
                end_date: endDateInput.value,
                requested_units: parseNullableDecimal(
                    calculateRequestedUnits(
                        leaveTypeRecord,
                        startDateInput.value,
                        endDateInput.value,
                        requestedUnitsInput.value,
                    ),
                ),
                status: statusSelect.value,
                reason: reasonInput.value.trim(),
                supporting_document_reference: documentReferenceInput.value.trim(),
                supporting_document_notes: documentNotesInput.value.trim(),
            };

            if (!payload.employee || !payload.leave_type || !payload.start_date || !payload.end_date) {
                alert("Please complete the employee, leave type, and date range.");
                return;
            }

            if (isManualRequestedUnitsLeaveType(leaveTypeRecord) && payload.requested_units === null) {
                alert("Enter the requested units for this leave type.");
                return;
            }

            try {
                const response = await fetch("/api/leave-applications/", {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "X-CSRFToken": csrftoken,
                    },
                    body: JSON.stringify(payload),
                });

                if (!response.ok) {
                    throw new Error(await readApiError(response, "Failed to file leave application"));
                }

                leaveApplicationModal.hide();
                leaveApplicationForm.reset();
                leaveApplicationRowEditor.reset();
                await loadLeaveCreditBalances();
                leaveApplicationTable.replaceData();
            } catch (err) {
                alert(err.message);
            }
        });
    })
    .catch(err => {
        console.error("Failed to initialize leave applications page:", err);
        alert("Failed to initialize leave applications.");
    });
