const employeePortalState = {
    employee: (window.HCM_PORTAL_CONTEXT && window.HCM_PORTAL_CONTEXT.employee) || null,
    leaveCredits: [],
    leaveApplications: [],
    applicationDetailsController: null,
};

const leavePortalStatusLabels = new Map([
    ["submitted", "Submitted"],
    ["approved", "Approved"],
    ["rejected", "Rejected"],
    ["cancelled", "Cancelled"],
]);

const employeePortalElements = {
    page: document.getElementById("employee-leave-portal-page") || document,
    refreshButton: document.getElementById("employee-portal-refresh-btn"),
    statusBanner: document.getElementById("employee-portal-status"),
    form: document.getElementById("employee-portal-leave-form"),
    leaveTypeSelect: document.getElementById("employee-portal-leave-type"),
    leaveTypeList: document.getElementById("employee-portal-leave-type-list"),
    selectedTypeName: document.getElementById("employee-portal-selected-type-name"),
    selectedTypeMeta: document.getElementById("employee-portal-selected-type-meta"),
    startDateInput: document.getElementById("employee-portal-start-date"),
    endDateInput: document.getElementById("employee-portal-end-date"),
    requestedUnitsInput: document.getElementById("employee-portal-requested-units"),
    requestedUnitsHelp: document.getElementById("employee-portal-units-help"),
    reasonInput: document.getElementById("employee-portal-reason"),
    applicationDetailsContainer: document.getElementById("employee-portal-application-details"),
    documentReferenceInput: document.getElementById("employee-portal-document-reference"),
    documentReferenceWrap: document.getElementById("employee-portal-document-reference-wrap"),
    documentNotesInput: document.getElementById("employee-portal-document-notes"),
    documentNotesWrap: document.getElementById("employee-portal-document-notes-wrap"),
    ruleAlerts: document.getElementById("employee-portal-rule-alerts"),
    resetButton: document.getElementById("employee-portal-reset-btn"),
    submitButton: document.getElementById("employee-portal-submit-btn"),
    summaryNumber: document.getElementById("employee-portal-summary-number"),
    summaryName: document.getElementById("employee-portal-summary-name"),
    summaryPosition: document.getElementById("employee-portal-summary-position"),
    summaryDivision: document.getElementById("employee-portal-summary-division"),
    ruleSummary: document.getElementById("employee-portal-rule-summary"),
    rulePayStatus: document.getElementById("employee-portal-rule-pay-status"),
    ruleBucket: document.getElementById("employee-portal-rule-bucket"),
    ruleBalance: document.getElementById("employee-portal-rule-balance"),
    ruleNotice: document.getElementById("employee-portal-rule-notice"),
    ruleMaxDays: document.getElementById("employee-portal-rule-max-days"),
    ruleDocs: document.getElementById("employee-portal-rule-docs"),
    ruleNotes: document.getElementById("employee-portal-rule-notes"),
    historyFilter: document.getElementById("employee-portal-history-filter"),
    historySearch: document.getElementById("employee-portal-history-search"),
    historyBody: document.getElementById("employee-portal-history-body"),
};

function employeePortalEscapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function employeePortalFormatUnits(value) {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? (value || "") : parsed.toFixed(2);
}

function employeePortalParseNullableDecimal(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const parsed = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ""));
    return Number.isNaN(parsed) ? null : parsed.toFixed(2);
}

function employeePortalFormatDate(value) {
    if (!value) {
        return "-";
    }

    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.valueOf())) {
        return value;
    }

    return parsed.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
    });
}

function employeePortalFormatDateRange(startDate, endDate) {
    if (!startDate && !endDate) {
        return "-";
    }

    if (startDate === endDate) {
        return employeePortalFormatDate(startDate);
    }

    return `${employeePortalFormatDate(startDate)} to ${employeePortalFormatDate(endDate)}`;
}

function employeePortalResolveLeaveTypeBucket(record) {
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

function employeePortalCalculateRequestedUnits(leaveTypeRecord, startDateValue, endDateValue, manualValue) {
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
    const cursor = new Date(startDate);

    while (cursor <= endDate) {
        calendarDays += 1;

        if (![0, 6].includes(cursor.getDay())) {
            workingDays += 1;
        }

        cursor.setDate(cursor.getDate() + 1);
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

function employeePortalIsManualUnitsLeaveType(leaveTypeRecord) {
    return !!leaveTypeRecord && leaveTypeRecord.entitlement_unit === "months";
}

function employeePortalGetAvailableBalance(leaveTypeRecord) {
    const bucket = employeePortalResolveLeaveTypeBucket(leaveTypeRecord);
    if (!bucket) {
        return null;
    }

    return employeePortalState.leaveCredits.find(credit => credit.bucket_code === bucket.bucketCode) || null;
}

function employeePortalGetSelectableLeaveTypes() {
    return Array.from(leaveTypeState.records.values())
        .filter(record => record.is_active && record.category !== "conversion")
        .sort((left, right) => {
            const leftOrder = Number(left.sort_order ?? 0);
            const rightOrder = Number(right.sort_order ?? 0);

            if (leftOrder !== rightOrder) {
                return leftOrder - rightOrder;
            }

            return String(left.leave_name || "").localeCompare(String(right.leave_name || ""));
        });
}

function employeePortalDescribeLeaveTypeAvailability(record) {
    const balanceBucket = employeePortalResolveLeaveTypeBucket(record);
    const availableCredit = employeePortalGetAvailableBalance(record);

    if (balanceBucket && availableCredit) {
        return {
            value: employeePortalFormatUnits(availableCredit.current_balance),
            label: "Available Credit",
        };
    }

    return {
        value: "N/A",
        label: "Available Credit",
    };
}

function employeePortalSetStatus(message, tone = "light") {
    if (!employeePortalElements.statusBanner) {
        return;
    }

    employeePortalElements.statusBanner.className = `leave-portal-status alert alert-${tone} border mt-4 mb-4`;
    employeePortalElements.statusBanner.textContent = message;
}

function employeePortalPopulateLeaveTypeSelect() {
    const leaveTypeOptions = employeePortalGetSelectableLeaveTypes().map(record => ({
        value: record.leave_type_id,
        label: record.leave_name,
    }));

    populateLookupSelect(
        employeePortalElements.leaveTypeSelect,
        leaveTypeOptions,
        "Select leave type",
    );
}

function employeePortalRenderEmployeeSummary() {
    const employee = employeePortalState.employee;

    if (employeePortalElements.summaryNumber) {
        employeePortalElements.summaryNumber.textContent = employee?.employee_id || "Not linked";
    }

    if (employeePortalElements.summaryName) {
        employeePortalElements.summaryName.textContent = employee
            ? `${employee.first_name} ${employee.last_name}`
            : "Employee link required";
    }

    if (employeePortalElements.summaryPosition) {
        employeePortalElements.summaryPosition.textContent = employee?.position_name || "-";
    }

    if (employeePortalElements.summaryDivision) {
        employeePortalElements.summaryDivision.textContent = employee?.division_name || "-";
    }
}

function employeePortalRenderLeaveTypeList() {
    if (!employeePortalElements.leaveTypeList) {
        return;
    }

    if (!employeePortalState.employee) {
        employeePortalElements.leaveTypeList.innerHTML = `
            <div class="employee-leave-portal__empty-note">
                A linked employee record is required before assigned leave types and balances can be loaded.
            </div>
        `;
        return;
    }

    const leaveTypes = employeePortalGetSelectableLeaveTypes();
    if (!leaveTypes.length) {
        employeePortalElements.leaveTypeList.innerHTML = `
            <div class="employee-leave-portal__empty-note">
                No active leave types are available for filing.
            </div>
        `;
        return;
    }

    const selectedLeaveTypeId = String(resolveLeaveTypeReference(employeePortalElements.leaveTypeSelect.value) || "");
    employeePortalElements.leaveTypeList.innerHTML = leaveTypes.map(record => {
        const availability = employeePortalDescribeLeaveTypeAvailability(record);
        const isSelected = String(record.leave_type_id) === selectedLeaveTypeId;

        return `
            <button
                type="button"
                class="employee-leave-portal__type-card ${isSelected ? "is-selected" : ""}"
                data-leave-type-id="${employeePortalEscapeHtml(record.leave_type_id)}"
            >
                <div class="employee-leave-portal__type-card-top">
                    <div class="employee-leave-portal__type-card-main">
                        <div class="employee-leave-portal__type-card-code">${employeePortalEscapeHtml(record.leave_code || "Leave Type")}</div>
                        <div class="employee-leave-portal__type-card-name">${employeePortalEscapeHtml(record.leave_name)}</div>
                    </div>
                    <div class="employee-leave-portal__type-card-balance">
                        <div class="employee-leave-portal__type-card-balance-value">${employeePortalEscapeHtml(availability.value)}</div>
                        <div class="employee-leave-portal__type-card-balance-label">${employeePortalEscapeHtml(availability.label)}</div>
                    </div>
                </div>
            </button>
        `;
    }).join("");
}

function employeePortalUpdateSelectedTypeSummary(leaveTypeRecord) {
    if (!employeePortalElements.selectedTypeName || !employeePortalElements.selectedTypeMeta) {
        return;
    }

    if (!leaveTypeRecord) {
        employeePortalElements.selectedTypeName.textContent = "Choose a leave type from the list on the left.";
        employeePortalElements.selectedTypeMeta.textContent = "Select a leave type to load the filing details.";
        return;
    }

    const availableCredit = employeePortalGetAvailableBalance(leaveTypeRecord);
    const detailParts = [leaveTypeRecord.leave_code].filter(Boolean);

    if (availableCredit) {
        detailParts.push(`Available credit: ${employeePortalFormatUnits(availableCredit.current_balance)}`);
    }

    employeePortalElements.selectedTypeName.textContent = leaveTypeRecord.leave_name || "Selected leave type";
    employeePortalElements.selectedTypeMeta.textContent = detailParts.join(" | ") || "Selected leave type";
}

function employeePortalRenderApplicationDetailFields(leaveTypeRecord) {
    const existingValues = employeePortalGetApplicationDetailValues();
    employeePortalState.applicationDetailsController = renderLeaveApplicationDetailFields(
        employeePortalElements.applicationDetailsContainer,
        {
            schema: leaveTypeRecord?.application_detail_schema || [],
            values: existingValues,
            idPrefix: "employee-portal-detail",
            emptyMessage: "No additional CSC filing details are required for the selected leave type.",
        },
    );
}

function employeePortalGetApplicationDetailValues() {
    return employeePortalState.applicationDetailsController?.getValues?.() || {};
}

function employeePortalBuildRuleAlerts(leaveTypeRecord) {
    const alerts = [];
    const startDate = employeePortalElements.startDateInput.value;
    const endDate = employeePortalElements.endDateInput.value;
    const availableCredit = employeePortalGetAvailableBalance(leaveTypeRecord);
    const calculatedUnits = employeePortalParseNullableDecimal(
        employeePortalCalculateRequestedUnits(
            leaveTypeRecord,
            startDate,
            endDate,
            employeePortalElements.requestedUnitsInput.value,
        ),
    );

    if (!leaveTypeRecord) {
        return alerts;
    }

    if (leaveTypeRecord.requires_supporting_document) {
        alerts.push({
            tone: "warning",
            message: leaveTypeRecord.supporting_document_notes || "This leave type requires a supporting document reference or note.",
        });
    }

    if (!startDate || !endDate) {
        return alerts;
    }

    const startDateObject = new Date(`${startDate}T00:00:00`);
    const endDateObject = new Date(`${endDate}T00:00:00`);

    if (Number.isNaN(startDateObject.valueOf()) || Number.isNaN(endDateObject.valueOf()) || endDateObject < startDateObject) {
        alerts.push({
            tone: "danger",
            message: "End date cannot be earlier than the start date.",
        });
        return alerts;
    }

    if (leaveTypeRecord.advance_notice_days) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const minStartDate = new Date(today);
        minStartDate.setDate(minStartDate.getDate() + leaveTypeRecord.advance_notice_days);

        if (startDateObject < minStartDate) {
            alerts.push({
                tone: "danger",
                message: `This leave type should be filed at least ${leaveTypeRecord.advance_notice_days} day(s) before the start date.`,
            });
        }
    }

    if (leaveTypeRecord.max_consecutive_days && calculatedUnits !== null) {
        const maxDays = Number.parseFloat(leaveTypeRecord.max_consecutive_days);
        const requestedUnits = Number.parseFloat(calculatedUnits);

        if (!Number.isNaN(maxDays) && !Number.isNaN(requestedUnits) && requestedUnits > maxDays) {
            alerts.push({
                tone: "danger",
                message: `The requested leave exceeds the maximum of ${employeePortalFormatUnits(maxDays)} unit(s) allowed in one application.`,
            });
        }
    }

    const balanceBucket = employeePortalResolveLeaveTypeBucket(leaveTypeRecord);
    if (balanceBucket && calculatedUnits !== null) {
        const requestedUnits = Number.parseFloat(calculatedUnits);
        const availableBalance = Number.parseFloat(availableCredit?.current_balance);

        if (!availableCredit) {
            alerts.push({
                tone: "danger",
                message: `No balance bucket is configured yet for ${balanceBucket.bucketName}.`,
            });
        } else if (!Number.isNaN(availableBalance) && !Number.isNaN(requestedUnits) && requestedUnits > availableBalance) {
            alerts.push({
                tone: "danger",
                message: `Requested units exceed the available balance of ${employeePortalFormatUnits(availableBalance)} in ${balanceBucket.bucketName}.`,
            });
        }
    }

    return alerts;
}

function employeePortalRenderRuleAlerts(alerts, leaveTypeRecord) {
    if (!leaveTypeRecord) {
        employeePortalElements.ruleAlerts.innerHTML = `
            <div class="alert alert-light mb-0">Select a leave type to evaluate the applicable filing checks.</div>
        `;
        return;
    }

    if (!alerts.length) {
        if (!employeePortalElements.startDateInput.value || !employeePortalElements.endDateInput.value) {
            employeePortalElements.ruleAlerts.innerHTML = `
                <div class="alert alert-light mb-0">Select the leave date range to run the filing checks for this leave type.</div>
            `;
            return;
        }

        employeePortalElements.ruleAlerts.innerHTML = `
            <div class="alert alert-success mb-0">The current leave inputs satisfy the visible filing checks.</div>
        `;
        return;
    }

    employeePortalElements.ruleAlerts.innerHTML = alerts.map(alertItem => `
        <div class="alert alert-${alertItem.tone} mb-0">${employeePortalEscapeHtml(alertItem.message)}</div>
    `).join("");
}

function employeePortalSyncForm() {
    const leaveTypeRecord = getLeaveTypeRecord(employeePortalElements.leaveTypeSelect.value);
    const balanceBucket = employeePortalResolveLeaveTypeBucket(leaveTypeRecord);
    const availableCredit = employeePortalGetAvailableBalance(leaveTypeRecord);
    const requiresManualUnits = employeePortalIsManualUnitsLeaveType(leaveTypeRecord);

    employeePortalRenderLeaveTypeList();
    employeePortalUpdateSelectedTypeSummary(leaveTypeRecord);
    employeePortalRenderApplicationDetailFields(leaveTypeRecord);

    employeePortalElements.ruleSummary.textContent = leaveTypeRecord?.entitlement_summary || "Select a leave type.";
    employeePortalElements.rulePayStatus.textContent = leaveTypeRecord?.pay_status_label || "-";
    employeePortalElements.ruleBucket.textContent = balanceBucket?.bucketName || "Not tracked";
    employeePortalElements.ruleBalance.textContent = availableCredit
        ? employeePortalFormatUnits(availableCredit.current_balance)
        : "N/A";
    employeePortalElements.ruleNotice.textContent = leaveTypeRecord?.advance_notice_days
        ? `${leaveTypeRecord.advance_notice_days} day(s)`
        : "None";
    employeePortalElements.ruleMaxDays.textContent = leaveTypeRecord?.max_consecutive_days
        ? employeePortalFormatUnits(leaveTypeRecord.max_consecutive_days)
        : "None";
    employeePortalElements.ruleDocs.textContent = leaveTypeRecord?.requires_supporting_document
        ? (leaveTypeRecord.supporting_document_notes || "Required")
        : "Not required";
    employeePortalElements.ruleNotes.textContent = leaveTypeRecord?.filing_notes
        || leaveTypeRecord?.eligibility_notes
        || leaveTypeRecord?.rule_notes
        || "Leave type notes and filing conditions will appear here.";

    employeePortalElements.requestedUnitsInput.disabled = !requiresManualUnits;
    employeePortalElements.requestedUnitsInput.required = requiresManualUnits;
    employeePortalElements.requestedUnitsHelp.textContent = requiresManualUnits
        ? "Enter the requested units manually for leave types measured in months or custom units."
        : "Units are automatically computed from the selected date range.";

    if (!requiresManualUnits) {
        employeePortalElements.requestedUnitsInput.value = employeePortalCalculateRequestedUnits(
            leaveTypeRecord,
            employeePortalElements.startDateInput.value,
            employeePortalElements.endDateInput.value,
            employeePortalElements.requestedUnitsInput.value,
        );
    }

    const requiresDocument = !!leaveTypeRecord?.requires_supporting_document;
    employeePortalElements.documentReferenceWrap.classList.toggle("d-none", !requiresDocument);
    employeePortalElements.documentNotesWrap.classList.toggle("d-none", !requiresDocument);

    const alerts = employeePortalBuildRuleAlerts(leaveTypeRecord);
    employeePortalRenderRuleAlerts(alerts, leaveTypeRecord);

    const hasBlockingAlerts = alerts.some(alertItem => alertItem.tone === "danger");
    const readyToSubmit = !!employeePortalState.employee && !!leaveTypeRecord && !hasBlockingAlerts;

    employeePortalElements.submitButton.disabled = !readyToSubmit;
}

function employeePortalGetFilteredHistory() {
    const searchTerm = employeePortalElements.historySearch?.value.trim().toLowerCase() || "";
    const selectedStatus = employeePortalElements.historyFilter?.value || "";

    return employeePortalState.leaveApplications.filter(application => {
        if (selectedStatus && application.status !== selectedStatus) {
            return false;
        }

        if (!searchTerm) {
            return true;
        }

        const searchableText = [
            application.leave_type_name,
            application.reason,
            application.application_detail_summary,
            application.status_label,
            application.entitlement_summary,
            application.current_approval_role_label,
            application.current_approver_name,
        ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

        return searchableText.includes(searchTerm);
    });
}

function employeePortalBuildStatusBadge(status, label) {
    const badgeClass = {
        submitted: "bg-warning text-dark",
        approved: "bg-success",
        rejected: "bg-danger",
        cancelled: "bg-secondary",
    }[status] || "bg-light text-dark";

    return `<span class="badge ${badgeClass}">${employeePortalEscapeHtml(label || leavePortalStatusLabels.get(status) || status || "-")}</span>`;
}

function employeePortalRenderHistory() {
    if (!employeePortalElements.historyBody) {
        return;
    }

    if (!employeePortalState.employee) {
        employeePortalElements.historyBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-4">A linked employee record is required to load leave history.</td>
            </tr>
        `;
        return;
    }

    const historyRows = employeePortalGetFilteredHistory();
    if (!historyRows.length) {
        employeePortalElements.historyBody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-4">No leave applications matched the current filters.</td>
            </tr>
        `;
        return;
    }

    employeePortalElements.historyBody.innerHTML = historyRows.map(application => `
        <tr>
            <td>
                <div class="fw-semibold">${employeePortalEscapeHtml(application.leave_type_name || formatLeaveTypeReference(application.leave_type))}</div>
                <div class="small text-muted">${employeePortalEscapeHtml(application.leave_code || "")}</div>
            </td>
            <td>${employeePortalEscapeHtml(employeePortalFormatDateRange(application.start_date, application.end_date))}</td>
            <td class="text-end">${employeePortalEscapeHtml(employeePortalFormatUnits(application.requested_units))}</td>
            <td>
                ${employeePortalBuildStatusBadge(application.status, application.status_label)}
                ${application.current_approval_role_label
                    ? `<div class="small text-muted mt-1">Current step: ${employeePortalEscapeHtml(application.current_approval_role_label)}</div>`
                    : ""}
            </td>
            <td class="small text-muted">${employeePortalEscapeHtml(application.entitlement_summary || "-")}</td>
            <td>
                <div>${employeePortalEscapeHtml(application.reason || "-")}</div>
                ${application.application_detail_summary
                    ? `<div class="small text-muted mt-1">${employeePortalEscapeHtml(application.application_detail_summary).replace(/\n/g, "<br>")}</div>`
                    : ""}
            </td>
            <td class="text-end">
                ${application.status === "submitted"
                    ? `<button type="button" class="btn btn-sm btn-outline-danger employee-portal-cancel-btn" data-leave-application-id="${application.leave_application_id}">
                            <i class="ti ti-x"></i> Cancel
                       </button>`
                    : `<span class="small text-muted">-</span>`}
            </td>
        </tr>
    `).join("");
}

async function employeePortalLoadEmployeeContext() {
    if (!employeePortalState.employee) {
        employeePortalState.leaveCredits = [];
        employeePortalState.leaveApplications = [];
        employeePortalRenderEmployeeSummary();
        employeePortalRenderHistory();
        employeePortalSyncForm();
        employeePortalSetStatus("A linked employee record is required before you can file leave.", "danger");
        return;
    }

    employeePortalSetStatus("Loading your leave balances and filing data...", "warning");

    const employeeId = employeePortalState.employee.id;
    const [creditsResponse, applicationsResponse] = await Promise.all([
        fetch(`/api/leave-credits/?employee=${encodeURIComponent(employeeId)}`),
        fetch(`/api/leave-applications/?employee=${encodeURIComponent(employeeId)}`),
    ]);

    if (!creditsResponse.ok) {
        throw new Error(await readApiError(creditsResponse, "Failed to load leave balances"));
    }

    if (!applicationsResponse.ok) {
        throw new Error(await readApiError(applicationsResponse, "Failed to load leave history"));
    }

    employeePortalState.leaveCredits = await creditsResponse.json();
    employeePortalState.leaveApplications = await applicationsResponse.json();

    employeePortalRenderEmployeeSummary();
    employeePortalRenderHistory();
    employeePortalSyncForm();
    employeePortalSetStatus(
        `Leave portal ready for ${employeePortalState.employee.first_name} ${employeePortalState.employee.last_name}.`,
        "success",
    );
}

function employeePortalResetForm() {
    employeePortalElements.form.reset();
    employeePortalPopulateLeaveTypeSelect();
    employeePortalElements.leaveTypeSelect.value = "";
    employeePortalElements.requestedUnitsInput.value = "";
    employeePortalSyncForm();
}

async function employeePortalSubmitLeaveApplication(event) {
    event.preventDefault();

    if (!employeePortalState.employee) {
        showSystemToast({
            title: "Employee Link Required",
            message: "Your account is not linked to an employee record.",
            tone: "danger",
        });
        return;
    }

    const leaveTypeRecord = getLeaveTypeRecord(employeePortalElements.leaveTypeSelect.value);
    const requestedUnits = employeePortalParseNullableDecimal(
        employeePortalCalculateRequestedUnits(
            leaveTypeRecord,
            employeePortalElements.startDateInput.value,
            employeePortalElements.endDateInput.value,
            employeePortalElements.requestedUnitsInput.value,
        ),
    );

    if (!employeePortalElements.form.reportValidity()) {
        return;
    }

    if (employeePortalIsManualUnitsLeaveType(leaveTypeRecord) && requestedUnits === null) {
        showSystemToast({
            title: "Requested Units Required",
            message: "Enter the requested units for this leave type.",
            tone: "warning",
        });
        return;
    }

    const payload = {
        employee: Number.parseInt(employeePortalState.employee.id, 10),
        leave_type: resolveLeaveTypeReference(employeePortalElements.leaveTypeSelect.value),
        start_date: employeePortalElements.startDateInput.value,
        end_date: employeePortalElements.endDateInput.value,
        requested_units: requestedUnits,
        status: "submitted",
        reason: employeePortalElements.reasonInput.value.trim(),
        application_details: employeePortalGetApplicationDetailValues(),
        supporting_document_reference: employeePortalElements.documentReferenceInput.value.trim(),
        supporting_document_notes: employeePortalElements.documentNotesInput.value.trim(),
    };

    if (!payload.leave_type || !payload.start_date || !payload.end_date) {
        showSystemToast({
            title: "Missing Fields",
            message: "Please select a leave type and complete the date range.",
            tone: "warning",
        });
        return;
    }

    employeePortalElements.submitButton.disabled = true;

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
            throw new Error(await readApiError(response, "Failed to submit leave application"));
        }

        await employeePortalLoadEmployeeContext();
        employeePortalResetForm();
        showSystemToast({
            title: "Leave Filed",
            message: "The leave application was submitted successfully.",
            tone: "success",
        });
    } catch (err) {
        employeePortalSyncForm();
        showSystemToast({
            title: "Submission Failed",
            message: err.message,
            tone: "danger",
        });
    }
}

async function employeePortalCancelLeaveApplication(leaveApplicationId) {
    const confirmed = await showSystemConfirm("Cancel this submitted leave application?", {
        title: "Cancel Leave Application?",
        confirmLabel: "Cancel Request",
        tone: "warning",
    });

    if (!confirmed) {
        return;
    }

    const response = await fetch(`/api/leave-applications/${leaveApplicationId}/`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrftoken,
        },
        body: JSON.stringify({ status: "cancelled" }),
    });

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to cancel leave application"));
    }

    await employeePortalLoadEmployeeContext();
    showSystemToast({
        title: "Leave Updated",
        message: "The leave application was cancelled.",
        tone: "success",
    });
}

function employeePortalBindEvents() {
    if (employeePortalElements.refreshButton) {
        employeePortalElements.refreshButton.addEventListener("click", async () => {
            try {
                await employeePortalLoadEmployeeContext();
            } catch (err) {
                showSystemToast({
                    title: "Refresh Failed",
                    message: err.message,
                    tone: "danger",
                });
            }
        });
    }

    employeePortalElements.leaveTypeList.addEventListener("click", event => {
        const leaveTypeCard = event.target.closest("[data-leave-type-id]");
        if (!leaveTypeCard) {
            return;
        }

        const leaveTypeId = leaveTypeCard.dataset.leaveTypeId;
        if (!leaveTypeId || employeePortalElements.leaveTypeSelect.value === leaveTypeId) {
            return;
        }

        employeePortalElements.leaveTypeSelect.value = leaveTypeId;
        employeePortalSyncForm();
    });

    [
        employeePortalElements.leaveTypeSelect,
        employeePortalElements.startDateInput,
        employeePortalElements.endDateInput,
        employeePortalElements.requestedUnitsInput,
        employeePortalElements.documentReferenceInput,
        employeePortalElements.documentNotesInput,
    ].forEach(element => {
        element.addEventListener("change", employeePortalSyncForm);
        element.addEventListener("input", employeePortalSyncForm);
    });

    employeePortalElements.resetButton.addEventListener("click", () => {
        employeePortalResetForm();
    });

    employeePortalElements.historyFilter?.addEventListener("change", employeePortalRenderHistory);
    employeePortalElements.historySearch?.addEventListener("input", employeePortalRenderHistory);

    employeePortalElements.historyBody?.addEventListener("click", event => {
        const cancelButton = event.target.closest(".employee-portal-cancel-btn");
        if (!cancelButton) {
            return;
        }

        const leaveApplicationId = cancelButton.dataset.leaveApplicationId;
        if (!leaveApplicationId) {
            return;
        }

        employeePortalCancelLeaveApplication(leaveApplicationId).catch(err => {
            showSystemToast({
                title: "Cancellation Failed",
                message: err.message,
                tone: "danger",
            });
        });
    });

    employeePortalElements.form.addEventListener("submit", employeePortalSubmitLeaveApplication);
}

async function initializeEmployeeLeavePortal() {
    if (!employeePortalElements.form || !employeePortalElements.leaveTypeSelect || !employeePortalElements.leaveTypeList) {
        return;
    }

    await loadLeaveTypes();
    employeePortalPopulateLeaveTypeSelect();

    initializeSearchableSelects(employeePortalElements.page, {
        selector: "select:not([data-no-enhance='true'])",
        searchPlaceholder: "Search records",
    });

    employeePortalBindEvents();
    employeePortalResetForm();
    await employeePortalLoadEmployeeContext();
}

initializeEmployeeLeavePortal().catch(err => {
    console.error("Failed to initialize employee leave portal:", err);
    showSystemToast({
        title: "Portal Error",
        message: err?.message || "Failed to initialize the employee leave portal.",
        tone: "danger",
    });
});
