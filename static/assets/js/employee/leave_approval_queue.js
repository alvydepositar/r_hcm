const leaveApprovalQueueState = {
    records: [],
    selectedApproval: null,
};

const leaveApprovalQueueElements = {
    searchInput: document.getElementById("employee-approval-search"),
    refreshButton: document.getElementById("employee-approval-refresh-btn"),
    countLabel: document.getElementById("employee-approval-count"),
    modalElement: document.getElementById("employeeLeaveApprovalModal"),
    modalEmployee: document.getElementById("approval-modal-employee"),
    modalLeaveType: document.getElementById("approval-modal-leave-type"),
    modalDateRange: document.getElementById("approval-modal-date-range"),
    modalRequestedUnits: document.getElementById("approval-modal-requested-units"),
    modalRole: document.getElementById("approval-modal-role"),
    modalReason: document.getElementById("approval-modal-reason"),
    modalDocument: document.getElementById("approval-modal-document"),
    modalApplicationDetails: document.getElementById("approval-modal-application-details"),
    modalNotes: document.getElementById("approval-modal-notes"),
    approveButton: document.getElementById("approval-modal-approve-btn"),
    rejectButton: document.getElementById("approval-modal-reject-btn"),
};

let leaveApprovalQueueTable = null;
let leaveApprovalQueueModal = null;

function leaveApprovalQueueEscapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function leaveApprovalQueueFormatDate(value) {
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

function leaveApprovalQueueFormatRange(startDate, endDate) {
    if (!startDate && !endDate) {
        return "-";
    }

    if (startDate === endDate) {
        return leaveApprovalQueueFormatDate(startDate);
    }

    return `${leaveApprovalQueueFormatDate(startDate)} to ${leaveApprovalQueueFormatDate(endDate)}`;
}

function leaveApprovalQueueFormatUnits(value) {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? (value || "") : parsed.toFixed(2);
}

function leaveApprovalQueueActionFormatter() {
    const iconButton = (className, variant, icon, label) => `
        <button
            class="btn btn-sm ${variant} hcm-table-action-btn ${className}"
            type="button"
            title="${label}"
            aria-label="${label}"
        >
            <i class="${icon}" aria-hidden="true"></i>
            <span class="visually-hidden">${label}</span>
        </button>
    `;

    return `
        <div class="d-flex gap-1 justify-content-center align-items-center hcm-table-actions">
            ${iconButton("employee-approval-view", "btn-outline-secondary", "ti ti-eye", "View")}
            ${iconButton("employee-approval-approve", "btn-outline-secondary", "ti ti-check", "Approve")}
            ${iconButton("employee-approval-reject", "btn-outline-secondary", "ti ti-x", "Reject")}
        </div>
    `;
}

function leaveApprovalQueueRenderCount() {
    leaveApprovalQueueElements.countLabel.textContent = `${leaveApprovalQueueState.records.length} pending approval(s)`;
}

function leaveApprovalQueueOpenModal(rowData, preferredAction = "") {
    leaveApprovalQueueState.selectedApproval = rowData;
    leaveApprovalQueueElements.modalEmployee.textContent = `${rowData.employee_number} - ${rowData.employee_name}`;
    leaveApprovalQueueElements.modalLeaveType.textContent = rowData.leave_type_name || "-";
    leaveApprovalQueueElements.modalDateRange.textContent = leaveApprovalQueueFormatRange(rowData.start_date, rowData.end_date);
    leaveApprovalQueueElements.modalRequestedUnits.textContent = leaveApprovalQueueFormatUnits(rowData.requested_units);
    leaveApprovalQueueElements.modalRole.textContent = rowData.approver_role_label || "-";
    leaveApprovalQueueElements.modalReason.textContent = rowData.reason || "-";
    leaveApprovalQueueElements.modalDocument.textContent = rowData.supporting_document_reference || rowData.supporting_document_notes || "No supporting document details provided.";
    leaveApprovalQueueElements.modalApplicationDetails.innerHTML = rowData.application_detail_summary
        ? leaveApprovalQueueEscapeHtml(rowData.application_detail_summary).replace(/\n/g, "<br>")
        : "No leave-specific filing details provided.";
    leaveApprovalQueueElements.modalNotes.value = "";

    leaveApprovalQueueElements.approveButton.classList.toggle("btn-primary", preferredAction !== "reject");
    leaveApprovalQueueElements.rejectButton.classList.toggle("btn-outline-danger", preferredAction !== "approve");

    leaveApprovalQueueModal.show();
}

async function leaveApprovalQueueLoadRecords() {
    const response = await fetch("/api/leave-approvals/?status=pending");
    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to load leave approvals"));
    }

    leaveApprovalQueueState.records = await response.json();
    leaveApprovalQueueRenderCount();

    if (!leaveApprovalQueueTable) {
        leaveApprovalQueueTable = new Tabulator("#employee-leave-approval-table", {
            data: leaveApprovalQueueState.records,
            layout: "fitDataStretch",
            placeholder: "No leave approvals are currently assigned to you.",
            pagination: "local",
            paginationSize: 10,
            columns: [
                { title: "Employee", field: "employee_name", width: 220, formatter: cell => `${cell.getRow().getData().employee_number} - ${cell.getValue()}` },
                { title: "Leave Type", field: "leave_type_name", width: 220 },
                { title: "Date Range", field: "start_date", width: 210, formatter: cell => leaveApprovalQueueFormatRange(cell.getRow().getData().start_date, cell.getRow().getData().end_date) },
                { title: "Units", field: "requested_units", width: 110, hozAlign: "right", formatter: cell => leaveApprovalQueueFormatUnits(cell.getValue()) },
                { title: "Approval Step", field: "approver_role_label", width: 180 },
                { title: "Reason", field: "reason", formatter: "textarea", width: 280 },
                {
                    title: "Actions",
                    field: "leave_application_approval_id",
                    headerSort: false,
                    width: 150,
                    hozAlign: "center",
                    formatter: leaveApprovalQueueActionFormatter,
                    cellClick: (event, cell) => {
                        const button = event.target.closest("button");
                        if (!button) {
                            return;
                        }

                        const rowData = cell.getRow().getData();
                        if (button.classList.contains("employee-approval-view")) {
                            leaveApprovalQueueOpenModal(rowData);
                            return;
                        }

                        if (button.classList.contains("employee-approval-approve")) {
                            leaveApprovalQueueOpenModal(rowData, "approve");
                            return;
                        }

                        if (button.classList.contains("employee-approval-reject")) {
                            leaveApprovalQueueOpenModal(rowData, "reject");
                        }
                    },
                },
            ],
        });
    } else {
        leaveApprovalQueueTable.replaceData(leaveApprovalQueueState.records);
    }
}

async function leaveApprovalQueueSubmitDecision(statusValue) {
    const currentApproval = leaveApprovalQueueState.selectedApproval;
    if (!currentApproval) {
        return;
    }

    const payload = {
        status: statusValue,
        decision_notes: leaveApprovalQueueElements.modalNotes.value.trim(),
    };

    const response = await fetch(`/api/leave-approvals/${currentApproval.leave_application_approval_id}/`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrftoken,
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(await readApiError(response, "Failed to update the leave approval"));
    }

    leaveApprovalQueueModal.hide();
    await leaveApprovalQueueLoadRecords();
    showSystemToast({
        title: "Approval Updated",
        message: statusValue === "approved"
            ? "The leave application was approved."
            : "The leave application was rejected.",
        tone: "success",
    });
}

function leaveApprovalQueueBindEvents() {
    leaveApprovalQueueElements.refreshButton.addEventListener("click", () => {
        leaveApprovalQueueLoadRecords().catch(err => {
            showSystemToast({
                title: "Refresh Failed",
                message: err.message,
                tone: "danger",
            });
        });
    });

    leaveApprovalQueueElements.searchInput.addEventListener("input", event => {
        const searchValue = event.target.value.trim().toLowerCase();

        if (!leaveApprovalQueueTable) {
            return;
        }

        if (!searchValue) {
            leaveApprovalQueueTable.clearFilter(true);
            return;
        }

        leaveApprovalQueueTable.setFilter(rowData => {
            return [
                rowData.employee_name,
                rowData.employee_number,
                rowData.leave_type_name,
                rowData.reason,
                rowData.application_detail_summary,
                rowData.approver_role_label,
            ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(searchValue);
        });
    });

    leaveApprovalQueueElements.approveButton.addEventListener("click", () => {
        leaveApprovalQueueSubmitDecision("approved").catch(err => {
            showSystemToast({
                title: "Approval Failed",
                message: err.message,
                tone: "danger",
            });
        });
    });

    leaveApprovalQueueElements.rejectButton.addEventListener("click", () => {
        leaveApprovalQueueSubmitDecision("rejected").catch(err => {
            showSystemToast({
                title: "Rejection Failed",
                message: err.message,
                tone: "danger",
            });
        });
    });
}

async function initializeLeaveApprovalQueue() {
    if (!leaveApprovalQueueElements.modalElement || !leaveApprovalQueueElements.countLabel) {
        return;
    }

    leaveApprovalQueueModal = new bootstrap.Modal(leaveApprovalQueueElements.modalElement);
    leaveApprovalQueueBindEvents();
    await leaveApprovalQueueLoadRecords();
}

initializeLeaveApprovalQueue().catch(err => {
    console.error("Failed to initialize the leave approval queue:", err);
    showSystemToast({
        title: "Queue Error",
        message: "Failed to initialize the leave approval queue.",
        tone: "danger",
    });
});
