const recruitmentOptions = JSON.parse(
    document.getElementById("recruitment-options")?.textContent || "{}"
);
const recruitmentPermissions = JSON.parse(
    document.getElementById("recruitment-permissions")?.textContent || "{}"
);

const statusToneMap = {
    draft: "secondary",
    submitted: "info",
    pending_division_chief: "warning",
    pending_hr: "warning",
    approved: "success",
    rejected: "danger",
    cancelled: "dark",
    pending_requestor_approval: "warning",
    pending_hr_publish_approval: "warning",
    published: "success",
    unpublished: "secondary",
    closed: "dark",
    queued: "secondary",
    pending: "warning",
    skipped: "dark",
};

const hiringRequestModalElement = document.getElementById("hiringRequestModal");
const hiringRequestModal = hiringRequestModalElement
    ? new bootstrap.Modal(hiringRequestModalElement)
    : null;
const jobPostingModalElement = document.getElementById("jobPostingModal");
const jobPostingModal = jobPostingModalElement
    ? new bootstrap.Modal(jobPostingModalElement)
    : null;
const recruitmentDecisionModalElement = document.getElementById("recruitmentDecisionModal");
const recruitmentDecisionModal = recruitmentDecisionModalElement
    ? new bootstrap.Modal(recruitmentDecisionModalElement)
    : null;

const hiringRequestForm = document.getElementById("hiring-request-form");
const jobPostingForm = document.getElementById("job-posting-form");

const decisionState = {
    endpoint: null,
    targetStatus: null,
    successMessage: "",
};

let hiringRequestsTable;
let hiringRequestApprovalsTable;
let jobPostingsTable;
let jobPostingApprovalsTable;

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function buildActionButton(action, label, className = "btn btn-sm btn-outline-primary") {
    return `<button type="button" class="${className}" data-action="${escapeHtml(action)}">${escapeHtml(label)}</button>`;
}

function makeStatusBadge(value, label) {
    const tone = statusToneMap[value] || "secondary";
    return `<span class="badge bg-${tone}-subtle text-${tone}">${escapeHtml(label || value || "Unknown")}</span>`;
}

function statusBadgeFormatter(field, labelField) {
    return cell => {
        const rowData = cell.getRow().getData();
        return makeStatusBadge(rowData[field], rowData[labelField]);
    };
}

function formatDateValue(value) {
    if (!value) {
        return "";
    }

    if (typeof value === "string" && value.length >= 10 && !value.includes("T")) {
        return value.slice(0, 10);
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return String(value);
    }

    return parsed.toLocaleDateString();
}

function formatDateTimeValue(value) {
    if (!value) {
        return "";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return String(value);
    }

    return parsed.toLocaleString();
}

function toDatetimeLocalValue(value) {
    if (!value) {
        return "";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return String(value).slice(0, 16);
    }

    const pad = number => String(number).padStart(2, "0");
    return [
        parsed.getFullYear(),
        pad(parsed.getMonth() + 1),
        pad(parsed.getDate()),
    ].join("-") + "T" + [pad(parsed.getHours()), pad(parsed.getMinutes())].join(":");
}

function normalizeNullableValue(value) {
    return value === "" || value === undefined ? null : value;
}

function normalizeIntegerValue(value) {
    if (value === "" || value === null || value === undefined) {
        return null;
    }

    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

function getOptionLabel(option, fallbackKey = "name") {
    if (option.label) {
        return option.label;
    }

    if (option.item_number) {
        const suffix = option.availability_label ? ` (${option.availability_label})` : "";
        return `${option.item_number} - ${option.position_name}${suffix}`;
    }

    if (option.abbreviation) {
        return `${option.name} (${option.abbreviation})`;
    }

    return option[fallbackKey] || "";
}

function setSelectOptions(select, options, { placeholder = "Select an option", selectedValue = "", allowBlank = true } = {}) {
    if (!select) {
        return;
    }

    const normalizedSelectedValue = selectedValue === null || selectedValue === undefined
        ? ""
        : String(selectedValue);

    const optionMarkup = [];
    if (allowBlank) {
        optionMarkup.push(`<option value="">${escapeHtml(placeholder)}</option>`);
    }

    options.forEach(option => {
        const value = String(option.id);
        const selectedAttr = value === normalizedSelectedValue ? " selected" : "";
        optionMarkup.push(
            `<option value="${escapeHtml(value)}"${selectedAttr}>${escapeHtml(getOptionLabel(option))}</option>`
        );
    });

    select.innerHTML = optionMarkup.join("");
}

function getMatchingPlantillaItems(divisionId, positionId) {
    return (recruitmentOptions.plantilla_items || []).filter(item => {
        const divisionMatches = !divisionId || String(item.division_id) === String(divisionId);
        const positionMatches = !positionId || String(item.position_id) === String(positionId);
        return divisionMatches && positionMatches;
    });
}

function syncHiringRequestPlantillaOptions(selectedValue = "") {
    const divisionId = document.getElementById("hiring-request-division")?.value;
    const positionId = document.getElementById("hiring-request-position")?.value;
    setSelectOptions(
        document.getElementById("hiring-request-plantilla"),
        getMatchingPlantillaItems(divisionId, positionId),
        {
            placeholder: "No plantilla item selected",
            selectedValue,
        }
    );
}

function syncJobPostingPlantillaOptions(selectedValue = "") {
    const divisionId = document.getElementById("job-posting-division")?.value;
    const positionId = document.getElementById("job-posting-position")?.value;
    setSelectOptions(
        document.getElementById("job-posting-plantilla"),
        getMatchingPlantillaItems(divisionId, positionId),
        {
            placeholder: "No plantilla item selected",
            selectedValue,
        }
    );
}

function populateLookupSelects() {
    setSelectOptions(
        document.getElementById("hiring-request-division"),
        recruitmentOptions.divisions || [],
        { placeholder: "Select division" }
    );
    setSelectOptions(
        document.getElementById("hiring-request-position"),
        recruitmentOptions.positions || [],
        { placeholder: "Select position" }
    );
    setSelectOptions(
        document.getElementById("job-posting-division"),
        recruitmentOptions.divisions || [],
        { placeholder: "Select division" }
    );
    setSelectOptions(
        document.getElementById("job-posting-position"),
        recruitmentOptions.positions || [],
        { placeholder: "Select position" }
    );
}

function populateRequestorRoles(selectedValue = "") {
    setSelectOptions(
        document.getElementById("hiring-request-role"),
        recruitmentPermissions.available_requestor_roles || [],
        {
            placeholder: "Select requestor role",
            selectedValue,
            allowBlank: false,
        }
    );
}

async function apiRequest(url, {
    method = "GET",
    payload = null,
    fallbackMessage = "Request failed",
} = {}) {
    const options = {
        method,
        headers: {
            "X-CSRFToken": csrftoken,
        },
    };

    if (payload !== null) {
        options.headers["Content-Type"] = "application/json";
        options.body = JSON.stringify(payload);
    }

    const response = await fetch(url, options);
    if (!response.ok) {
        throw new Error(await readApiError(response, fallbackMessage));
    }

    if (response.status === 204) {
        return null;
    }

    return response.json();
}

function matchAnySearch(data, params) {
    const searchTerm = String(params.term || "").toLowerCase();
    return Object.values(data || {}).some(value =>
        String(value ?? "").toLowerCase().includes(searchTerm)
    );
}

function bindTableSearch(inputId, table) {
    const input = document.getElementById(inputId);
    if (!input || !table) {
        return;
    }

    input.addEventListener("input", event => {
        const value = event.target.value.trim().toLowerCase();
        if (!value) {
            table.clearFilter();
            return;
        }

        table.setFilter(matchAnySearch, { term: value });
    });
}

function refreshAllTables() {
    [hiringRequestsTable, hiringRequestApprovalsTable, jobPostingsTable, jobPostingApprovalsTable]
        .filter(Boolean)
        .forEach(table => table.replaceData());
}

function showSuccess(message) {
    if (typeof showSystemToast === "function") {
        showSystemToast({ message, tone: "success", title: "Updated" });
        return;
    }

    alert(message);
}

function canManageRequestRow(rowData) {
    return recruitmentPermissions.is_hr || rowData.requestor_username === recruitmentPermissions.username;
}

function getHiringRequestActions(rowData) {
    const actions = [];
    const canManage = canManageRequestRow(rowData);
    const editableStatuses = ["draft", "rejected", "cancelled"];

    if (canManage && editableStatuses.includes(rowData.status)) {
        actions.push(buildActionButton("edit", "Edit"));
        actions.push(buildActionButton("submit", "Submit", "btn btn-sm btn-primary"));
    }

    if (canManage && !["approved", "cancelled"].includes(rowData.status)) {
        actions.push(buildActionButton("cancel", "Cancel", "btn btn-sm btn-outline-danger"));
    }

    return actions.length
        ? `<div class="d-flex flex-wrap gap-1">${actions.join("")}</div>`
        : '<span class="text-muted small">No actions</span>';
}

function getHiringApprovalActions(rowData) {
    const canAct = rowData.status === "pending"
        && (recruitmentPermissions.is_hr || rowData.approver_username === recruitmentPermissions.username);

    if (!canAct) {
        return '<span class="text-muted small">No actions</span>';
    }

    return `<div class="d-flex flex-wrap gap-1">
        ${buildActionButton("approve", "Approve", "btn btn-sm btn-success")}
        ${buildActionButton("reject", "Reject", "btn btn-sm btn-outline-danger")}
    </div>`;
}

function getJobPostingActions(rowData) {
    const actions = [];

    if (recruitmentPermissions.can_manage_job_postings) {
        if (rowData.status !== "pending_requestor_approval") {
            actions.push(buildActionButton("edit", "Edit"));
        }

        if (rowData.status === "published") {
            actions.push(buildActionButton("unpublish", "Unpublish", "btn btn-sm btn-outline-warning"));
        }

        if (["published", "unpublished"].includes(rowData.status)) {
            actions.push(buildActionButton("close", "Close", "btn btn-sm btn-outline-danger"));
        }
    }

    return actions.length
        ? `<div class="d-flex flex-wrap gap-1">${actions.join("")}</div>`
        : '<span class="text-muted small">No actions</span>';
}

function getJobPostingApprovalActions(rowData) {
    const canAct = rowData.status === "pending"
        && (recruitmentPermissions.is_hr || rowData.approver_username === recruitmentPermissions.username);

    if (!canAct) {
        return '<span class="text-muted small">No actions</span>';
    }

    return `<div class="d-flex flex-wrap gap-1">
        ${buildActionButton("approve", "Approve", "btn btn-sm btn-success")}
        ${buildActionButton("reject", "Reject", "btn btn-sm btn-outline-danger")}
    </div>`;
}

function resetHiringRequestForm(record = null) {
    hiringRequestForm.reset();
    document.getElementById("hiring-request-id").value = record?.hiring_request_id || "";
    document.getElementById("hiring-request-modal-title").textContent = record
        ? `Edit Hiring Request ${record.request_no || ""}`.trim()
        : "New Hiring Request";

    populateRequestorRoles(record?.requestor_role || recruitmentPermissions.available_requestor_roles?.[0]?.id || "");
    populateLookupSelects();
    setSelectOptions(
        document.getElementById("hiring-request-division"),
        recruitmentOptions.divisions || [],
        {
            placeholder: "Select division",
            selectedValue: record?.division || "",
        }
    );
    setSelectOptions(
        document.getElementById("hiring-request-position"),
        recruitmentOptions.positions || [],
        {
            placeholder: "Select position",
            selectedValue: record?.position || "",
        }
    );
    syncHiringRequestPlantillaOptions(record?.plantilla_item || "");

    document.getElementById("hiring-request-role").disabled = Boolean(record);
    document.getElementById("hiring-request-headcount").value = record?.headcount_requested ?? 1;
    document.getElementById("hiring-request-employment-type").value = record?.employment_type || "";
    document.getElementById("hiring-request-start-date").value = record?.target_start_date || "";
    document.getElementById("hiring-request-reason").value = record?.hiring_reason || "";
    document.getElementById("hiring-request-justification").value = record?.justification || "";

    const saveDraftButton = document.getElementById("save-hiring-request-draft-btn");
    const submitButton = document.getElementById("submit-hiring-request-btn");
    const canSubmit = !record || ["draft", "rejected", "cancelled"].includes(record.status);

    saveDraftButton.textContent = record ? "Save Changes" : "Save Draft";
    submitButton.classList.toggle("d-none", !canSubmit);
}

function openHiringRequestModal(record = null) {
    resetHiringRequestForm(record);
    hiringRequestModal.show();
}

function collectHiringRequestPayload() {
    return {
        requestor_role: document.getElementById("hiring-request-role").value,
        division: normalizeIntegerValue(document.getElementById("hiring-request-division").value),
        position: normalizeIntegerValue(document.getElementById("hiring-request-position").value),
        plantilla_item: normalizeIntegerValue(document.getElementById("hiring-request-plantilla").value),
        headcount_requested: normalizeIntegerValue(document.getElementById("hiring-request-headcount").value),
        employment_type: document.getElementById("hiring-request-employment-type").value.trim(),
        target_start_date: document.getElementById("hiring-request-start-date").value,
        hiring_reason: document.getElementById("hiring-request-reason").value.trim(),
        justification: document.getElementById("hiring-request-justification").value.trim(),
    };
}

async function saveHiringRequest(targetStatus = null) {
    const requestId = document.getElementById("hiring-request-id").value;
    const payload = collectHiringRequestPayload();
    if (targetStatus) {
        payload.status = targetStatus;
    }

    const url = requestId
        ? `/api/hiring-requests/${requestId}/`
        : "/api/hiring-requests/";
    const method = requestId ? "PATCH" : "POST";
    const successMessage = requestId
        ? (targetStatus === "submitted" ? "Hiring request submitted." : "Hiring request updated.")
        : (targetStatus === "submitted" ? "Hiring request created and submitted." : "Hiring request saved.");

    await apiRequest(url, {
        method,
        payload,
        fallbackMessage: "Unable to save the hiring request.",
    });

    hiringRequestModal.hide();
    refreshAllTables();
    showSuccess(successMessage);
}

function resetJobPostingForm(record) {
    jobPostingForm.reset();
    document.getElementById("job-posting-id").value = record?.job_posting_id || "";
    document.getElementById("job-posting-modal-title").textContent = record?.posting_no
        ? `Edit Job Posting ${record.posting_no}`
        : "Edit Job Posting";

    populateLookupSelects();
    setSelectOptions(
        document.getElementById("job-posting-division"),
        recruitmentOptions.divisions || [],
        {
            placeholder: "Select division",
            selectedValue: record?.division || "",
        }
    );
    setSelectOptions(
        document.getElementById("job-posting-position"),
        recruitmentOptions.positions || [],
        {
            placeholder: "Select position",
            selectedValue: record?.position || "",
        }
    );
    syncJobPostingPlantillaOptions(record?.plantilla_item || "");

    document.getElementById("job-posting-title").value = record?.job_title || "";
    document.getElementById("job-posting-employment-type").value = record?.employment_type || "";
    document.getElementById("job-posting-open-slots").value = record?.open_slots ?? 1;
    document.getElementById("job-posting-work-location").value = record?.work_location || "";
    document.getElementById("job-posting-summary").value = record?.job_summary || "";
    document.getElementById("job-posting-description").value = record?.job_description || "";
    document.getElementById("job-posting-qualifications").value = record?.qualifications || "";
    document.getElementById("job-posting-publish-start").value = toDatetimeLocalValue(record?.publish_start);
    document.getElementById("job-posting-publish-end").value = toDatetimeLocalValue(record?.publish_end);

    const submitButton = document.getElementById("submit-job-posting-btn");
    submitButton.classList.toggle(
        "d-none",
        !["draft", "rejected", "unpublished", "closed", "pending_hr_publish_approval", "published"].includes(record?.status)
    );
}

function openJobPostingModal(record) {
    resetJobPostingForm(record);
    jobPostingModal.show();
}

function collectJobPostingPayload() {
    return {
        division: normalizeIntegerValue(document.getElementById("job-posting-division").value),
        position: normalizeIntegerValue(document.getElementById("job-posting-position").value),
        plantilla_item: normalizeIntegerValue(document.getElementById("job-posting-plantilla").value),
        job_title: document.getElementById("job-posting-title").value.trim(),
        job_summary: document.getElementById("job-posting-summary").value.trim(),
        job_description: document.getElementById("job-posting-description").value.trim(),
        qualifications: document.getElementById("job-posting-qualifications").value.trim(),
        employment_type: document.getElementById("job-posting-employment-type").value.trim(),
        work_location: document.getElementById("job-posting-work-location").value.trim(),
        open_slots: normalizeIntegerValue(document.getElementById("job-posting-open-slots").value),
        publish_start: normalizeNullableValue(document.getElementById("job-posting-publish-start").value),
        publish_end: normalizeNullableValue(document.getElementById("job-posting-publish-end").value),
    };
}

async function saveJobPosting({ submitForApproval = false } = {}) {
    const postingId = document.getElementById("job-posting-id").value;
    if (!postingId) {
        alert("Select a job posting to edit.");
        return;
    }

    const payload = collectJobPostingPayload();
    if (submitForApproval) {
        payload.status = "pending_requestor_approval";
    }

    await apiRequest(`/api/job-postings/${postingId}/`, {
        method: "PATCH",
        payload,
        fallbackMessage: "Unable to save the job posting.",
    });

    jobPostingModal.hide();
    refreshAllTables();
    showSuccess(submitForApproval ? "Job posting sent for requestor approval." : "Job posting updated.");
}

function openDecisionModal({
    endpoint,
    title,
    summary,
    targetStatus,
    confirmLabel,
    confirmClass,
    successMessage,
}) {
    decisionState.endpoint = endpoint;
    decisionState.targetStatus = targetStatus;
    decisionState.successMessage = successMessage;

    document.getElementById("recruitment-decision-title").textContent = title;
    document.getElementById("recruitment-decision-summary").textContent = summary;
    document.getElementById("recruitment-decision-notes").value = "";

    const confirmButton = document.getElementById("recruitment-decision-confirm-btn");
    confirmButton.textContent = confirmLabel;
    confirmButton.className = confirmClass;

    recruitmentDecisionModal.show();
}

async function submitDecision() {
    if (!decisionState.endpoint || !decisionState.targetStatus) {
        return;
    }

    const notes = document.getElementById("recruitment-decision-notes").value.trim();
    await apiRequest(decisionState.endpoint, {
        method: "PATCH",
        payload: {
            status: decisionState.targetStatus,
            decision_notes: notes,
        },
        fallbackMessage: "Unable to record the decision.",
    });

    recruitmentDecisionModal.hide();
    refreshAllTables();
    showSuccess(decisionState.successMessage || "Decision saved.");
}

function createHiringRequestsTable() {
    hiringRequestsTable = new Tabulator("#recruitment-hiring-requests-table", {
        layout: "fitColumns",
        height: "520px",
        index: "hiring_request_id",
        ajaxURL: "/api/hiring-requests/",
        pagination: "local",
        paginationSize: 10,
        placeholder: "No hiring requests available",
        columns: [
            { title: "Request No.", field: "request_no", width: 150 },
            { title: "Requestor", field: "requestor_name", minWidth: 170 },
            { title: "Role", field: "requestor_role_label", width: 160 },
            { title: "Division", field: "division_name", minWidth: 170 },
            { title: "Position", field: "position_name", minWidth: 170 },
            { title: "Headcount", field: "headcount_requested", hozAlign: "center", width: 110 },
            { title: "Type", field: "employment_type", minWidth: 140 },
            {
                title: "Status",
                field: "status",
                width: 170,
                formatter: statusBadgeFormatter("status", "status_label"),
            },
            {
                title: "Current Step",
                field: "current_approval_role_label",
                minWidth: 160,
                formatter: cell => escapeHtml(cell.getValue() || "-"),
            },
            {
                title: "Target Start",
                field: "target_start_date",
                width: 130,
                formatter: cell => escapeHtml(formatDateValue(cell.getValue()) || "-"),
            },
            {
                title: "Actions",
                field: "actions",
                minWidth: 250,
                headerSort: false,
                formatter: cell => getHiringRequestActions(cell.getRow().getData()),
                cellClick: async (event, cell) => {
                    const actionButton = event.target.closest("[data-action]");
                    if (!actionButton) {
                        return;
                    }

                    const rowData = cell.getRow().getData();
                    const action = actionButton.dataset.action;

                    if (action === "edit") {
                        openHiringRequestModal(rowData);
                        return;
                    }

                    if (action === "submit") {
                        const confirmed = await showSystemConfirm(
                            `Submit hiring request ${rowData.request_no}?`,
                            { title: "Submit hiring request?", confirmLabel: "Submit", tone: "primary" }
                        );
                        if (confirmed) {
                            await apiRequest(`/api/hiring-requests/${rowData.hiring_request_id}/`, {
                                method: "PATCH",
                                payload: { status: "submitted" },
                                fallbackMessage: "Unable to submit the hiring request.",
                            });
                            refreshAllTables();
                            showSuccess("Hiring request submitted.");
                        }
                        return;
                    }

                    if (action === "cancel") {
                        const confirmed = await showSystemConfirm(
                            `Cancel hiring request ${rowData.request_no}?`,
                            { title: "Cancel hiring request?", confirmLabel: "Cancel request", tone: "warning" }
                        );
                        if (confirmed) {
                            await apiRequest(`/api/hiring-requests/${rowData.hiring_request_id}/`, {
                                method: "PATCH",
                                payload: { status: "cancelled" },
                                fallbackMessage: "Unable to cancel the hiring request.",
                            });
                            refreshAllTables();
                            showSuccess("Hiring request cancelled.");
                        }
                    }
                },
            },
        ],
    });
}

function createHiringApprovalsTable() {
    hiringRequestApprovalsTable = new Tabulator("#recruitment-hiring-approvals-table", {
        layout: "fitColumns",
        height: "520px",
        index: "hiring_request_approval_id",
        ajaxURL: "/api/hiring-request-approvals/",
        pagination: "local",
        paginationSize: 10,
        placeholder: "No hiring approvals available",
        columns: [
            { title: "Request No.", field: "request_no", width: 150 },
            { title: "Approver Role", field: "approver_role_label", minWidth: 170 },
            { title: "Requestor", field: "requestor_username", minWidth: 150 },
            { title: "Division", field: "division_name", minWidth: 170 },
            { title: "Position", field: "position_name", minWidth: 170 },
            { title: "Headcount", field: "headcount_requested", hozAlign: "center", width: 110 },
            {
                title: "Status",
                field: "status",
                width: 150,
                formatter: statusBadgeFormatter("status", "status_label"),
            },
            {
                title: "Acted At",
                field: "acted_at",
                minWidth: 170,
                formatter: cell => escapeHtml(formatDateTimeValue(cell.getValue()) || "-"),
            },
            {
                title: "Actions",
                field: "actions",
                minWidth: 200,
                headerSort: false,
                formatter: cell => getHiringApprovalActions(cell.getRow().getData()),
                cellClick: (event, cell) => {
                    const actionButton = event.target.closest("[data-action]");
                    if (!actionButton) {
                        return;
                    }

                    const rowData = cell.getRow().getData();
                    const isApprove = actionButton.dataset.action === "approve";
                    openDecisionModal({
                        endpoint: `/api/hiring-request-approvals/${rowData.hiring_request_approval_id}/`,
                        title: isApprove ? "Approve hiring request" : "Reject hiring request",
                        summary: `${rowData.request_no} · ${rowData.position_name} · ${rowData.division_name}`,
                        targetStatus: isApprove ? "approved" : "rejected",
                        confirmLabel: isApprove ? "Approve" : "Reject",
                        confirmClass: isApprove ? "btn btn-success" : "btn btn-danger",
                        successMessage: isApprove ? "Hiring request approved." : "Hiring request rejected.",
                    });
                },
            },
        ],
    });
}

function createJobPostingsTable() {
    jobPostingsTable = new Tabulator("#recruitment-job-postings-table", {
        layout: "fitColumns",
        height: "520px",
        index: "job_posting_id",
        ajaxURL: "/api/job-postings/",
        pagination: "local",
        paginationSize: 10,
        placeholder: "No job postings available",
        columns: [
            { title: "Posting No.", field: "posting_no", width: 150 },
            { title: "Job Title", field: "job_title", minWidth: 190 },
            { title: "Requestor", field: "requestor_name", minWidth: 170 },
            { title: "Division", field: "division_name", minWidth: 170 },
            { title: "Position", field: "position_name", minWidth: 170 },
            { title: "Slots", field: "open_slots", hozAlign: "center", width: 90 },
            {
                title: "Status",
                field: "status",
                width: 180,
                formatter: statusBadgeFormatter("status", "status_label"),
            },
            {
                title: "Portal",
                field: "portal_status",
                width: 160,
                formatter: statusBadgeFormatter("portal_status", "portal_status_label"),
            },
            {
                title: "Published",
                field: "published_at",
                minWidth: 170,
                formatter: cell => escapeHtml(formatDateTimeValue(cell.getValue()) || "-"),
            },
            {
                title: "Actions",
                field: "actions",
                minWidth: 220,
                headerSort: false,
                formatter: cell => getJobPostingActions(cell.getRow().getData()),
                cellClick: async (event, cell) => {
                    const actionButton = event.target.closest("[data-action]");
                    if (!actionButton) {
                        return;
                    }

                    const rowData = cell.getRow().getData();
                    const action = actionButton.dataset.action;

                    if (action === "edit") {
                        openJobPostingModal(rowData);
                        return;
                    }

                    if (action === "unpublish") {
                        const confirmed = await showSystemConfirm(
                            `Unpublish job posting ${rowData.posting_no}?`,
                            { title: "Unpublish posting?", confirmLabel: "Unpublish", tone: "warning" }
                        );
                        if (confirmed) {
                            await apiRequest(`/api/job-postings/${rowData.job_posting_id}/`, {
                                method: "PATCH",
                                payload: { status: "unpublished" },
                                fallbackMessage: "Unable to unpublish the job posting.",
                            });
                            refreshAllTables();
                            showSuccess("Job posting unpublished.");
                        }
                        return;
                    }

                    if (action === "close") {
                        const confirmed = await showSystemConfirm(
                            `Close job posting ${rowData.posting_no}?`,
                            { title: "Close posting?", confirmLabel: "Close posting", tone: "danger" }
                        );
                        if (confirmed) {
                            await apiRequest(`/api/job-postings/${rowData.job_posting_id}/`, {
                                method: "PATCH",
                                payload: { status: "closed" },
                                fallbackMessage: "Unable to close the job posting.",
                            });
                            refreshAllTables();
                            showSuccess("Job posting closed.");
                        }
                    }
                },
            },
        ],
    });
}

function createJobPostingApprovalsTable() {
    jobPostingApprovalsTable = new Tabulator("#recruitment-job-posting-approvals-table", {
        layout: "fitColumns",
        height: "520px",
        index: "job_posting_approval_id",
        ajaxURL: "/api/job-posting-approvals/",
        pagination: "local",
        paginationSize: 10,
        placeholder: "No posting approvals available",
        columns: [
            { title: "Posting No.", field: "posting_no", width: 150 },
            { title: "Approver Role", field: "approver_role_label", minWidth: 170 },
            { title: "Job Title", field: "job_title", minWidth: 190 },
            { title: "Division", field: "division_name", minWidth: 170 },
            {
                title: "Posting Status",
                field: "posting_status",
                minWidth: 180,
                formatter: statusBadgeFormatter("posting_status", "posting_status_label"),
            },
            {
                title: "Decision Status",
                field: "status",
                width: 160,
                formatter: statusBadgeFormatter("status", "status_label"),
            },
            {
                title: "Acted At",
                field: "acted_at",
                minWidth: 170,
                formatter: cell => escapeHtml(formatDateTimeValue(cell.getValue()) || "-"),
            },
            {
                title: "Actions",
                field: "actions",
                minWidth: 200,
                headerSort: false,
                formatter: cell => getJobPostingApprovalActions(cell.getRow().getData()),
                cellClick: (event, cell) => {
                    const actionButton = event.target.closest("[data-action]");
                    if (!actionButton) {
                        return;
                    }

                    const rowData = cell.getRow().getData();
                    const isApprove = actionButton.dataset.action === "approve";
                    openDecisionModal({
                        endpoint: `/api/job-posting-approvals/${rowData.job_posting_approval_id}/`,
                        title: isApprove ? "Approve job posting" : "Reject job posting",
                        summary: `${rowData.posting_no} · ${rowData.job_title} · ${rowData.division_name}`,
                        targetStatus: isApprove ? "approved" : "rejected",
                        confirmLabel: isApprove ? "Approve" : "Reject",
                        confirmClass: isApprove ? "btn btn-success" : "btn btn-danger",
                        successMessage: isApprove ? "Job posting approval recorded." : "Job posting rejected.",
                    });
                },
            },
        ],
    });
}

function bindLookupEvents() {
    document.getElementById("hiring-request-division")?.addEventListener("change", () => {
        syncHiringRequestPlantillaOptions();
    });
    document.getElementById("hiring-request-position")?.addEventListener("change", () => {
        syncHiringRequestPlantillaOptions();
    });
    document.getElementById("job-posting-division")?.addEventListener("change", () => {
        syncJobPostingPlantillaOptions();
    });
    document.getElementById("job-posting-position")?.addEventListener("change", () => {
        syncJobPostingPlantillaOptions();
    });
}

function bindToolbarEvents() {
    document.getElementById("refresh-recruitment-data-btn")?.addEventListener("click", () => {
        window.location.reload();
    });
    document.getElementById("refresh-hiring-requests-btn")?.addEventListener("click", () => {
        hiringRequestsTable?.replaceData();
    });
    document.getElementById("refresh-hiring-approvals-btn")?.addEventListener("click", () => {
        hiringRequestApprovalsTable?.replaceData();
    });
    document.getElementById("refresh-job-postings-btn")?.addEventListener("click", () => {
        jobPostingsTable?.replaceData();
    });
    document.getElementById("refresh-job-posting-approvals-btn")?.addEventListener("click", () => {
        jobPostingApprovalsTable?.replaceData();
    });
    document.getElementById("add-hiring-request-btn")?.addEventListener("click", () => {
        openHiringRequestModal();
    });
}

function bindFormEvents() {
    if (hiringRequestForm) {
        document.getElementById("save-hiring-request-draft-btn")?.addEventListener("click", async event => {
            event.preventDefault();
            await saveHiringRequest();
        });

        hiringRequestForm.addEventListener("submit", async event => {
            event.preventDefault();
            await saveHiringRequest("submitted");
        });
    }

    if (jobPostingForm) {
        jobPostingForm.addEventListener("submit", async event => {
            event.preventDefault();
            await saveJobPosting();
        });

        document.getElementById("submit-job-posting-btn")?.addEventListener("click", async () => {
            await saveJobPosting({ submitForApproval: true });
        });
    }

    document.getElementById("recruitment-decision-confirm-btn")?.addEventListener("click", async () => {
        await submitDecision();
    });
}

function initRecruitmentWorkspace() {
    populateLookupSelects();
    bindLookupEvents();

    if (document.getElementById("recruitment-hiring-requests-table")) {
        createHiringRequestsTable();
        bindTableSearch("hiring-requests-search", hiringRequestsTable);
    }

    if (document.getElementById("recruitment-hiring-approvals-table")) {
        createHiringApprovalsTable();
        bindTableSearch("hiring-approvals-search", hiringRequestApprovalsTable);
    }

    if (document.getElementById("recruitment-job-postings-table")) {
        createJobPostingsTable();
        bindTableSearch("job-postings-search", jobPostingsTable);
    }

    if (document.getElementById("recruitment-job-posting-approvals-table")) {
        createJobPostingApprovalsTable();
        bindTableSearch("job-posting-approvals-search", jobPostingApprovalsTable);
    }

    bindToolbarEvents();
    bindFormEvents();
}

initRecruitmentWorkspace();
