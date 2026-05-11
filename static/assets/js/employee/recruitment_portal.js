const requestorRecruitmentOptions = JSON.parse(
    document.getElementById("requestor-recruitment-options")?.textContent || "{}"
);
const requestorRecruitmentPermissions = JSON.parse(
    document.getElementById("requestor-recruitment-permissions")?.textContent || "{}"
);

const requestorStatusToneMap = {
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
    hidden: "secondary",
    scheduled: "info",
    expired: "dark",
    queued: "secondary",
    pending: "warning",
    skipped: "dark",
};

const requestorPortalElements = {
    form: document.getElementById("requestor-hiring-request-form"),
    addHiringRequestButton: document.getElementById("requestor-add-hiring-request-btn"),
    refreshAllButton: document.getElementById("requestor-refresh-recruitment-btn"),
    refreshMyRequestsButton: document.getElementById("requestor-refresh-my-requests-btn"),
    refreshHiringApprovalsButton: document.getElementById("requestor-refresh-hiring-approvals-btn"),
    refreshJobPostingReviewsButton: document.getElementById("requestor-refresh-job-posting-reviews-btn"),
    myRequestsSearch: document.getElementById("requestor-my-requests-search"),
    hiringApprovalsSearch: document.getElementById("requestor-hiring-approvals-search"),
    jobPostingReviewsSearch: document.getElementById("requestor-job-posting-reviews-search"),
    modalTitle: document.getElementById("requestor-hiring-request-modal-title"),
    requestIdInput: document.getElementById("requestor-hiring-request-id"),
    requestorRoleInput: document.getElementById("requestor-hiring-request-role"),
    headcountInput: document.getElementById("requestor-hiring-request-headcount"),
    divisionInput: document.getElementById("requestor-hiring-request-division"),
    positionInput: document.getElementById("requestor-hiring-request-position"),
    plantillaInput: document.getElementById("requestor-hiring-request-plantilla"),
    startDateInput: document.getElementById("requestor-hiring-request-start-date"),
    employmentTypeInput: document.getElementById("requestor-hiring-request-employment-type"),
    reasonInput: document.getElementById("requestor-hiring-request-reason"),
    justificationInput: document.getElementById("requestor-hiring-request-justification"),
    saveDraftButton: document.getElementById("requestor-save-hiring-request-draft-btn"),
    submitButton: document.getElementById("requestor-submit-hiring-request-btn"),
    decisionTitle: document.getElementById("requestor-recruitment-decision-title"),
    decisionSummary: document.getElementById("requestor-recruitment-decision-summary"),
    decisionNotes: document.getElementById("requestor-recruitment-decision-notes"),
    decisionConfirmButton: document.getElementById("requestor-recruitment-decision-confirm-btn"),
    previewTitle: document.getElementById("requestor-job-posting-preview-title"),
    previewSubtitle: document.getElementById("requestor-job-posting-preview-subtitle"),
    previewStatus: document.getElementById("requestor-job-posting-preview-status"),
    previewPortalStatus: document.getElementById("requestor-job-posting-preview-portal-status"),
    previewDivision: document.getElementById("requestor-job-posting-preview-division"),
    previewPosition: document.getElementById("requestor-job-posting-preview-position"),
    previewEmploymentType: document.getElementById("requestor-job-posting-preview-employment-type"),
    previewWorkLocation: document.getElementById("requestor-job-posting-preview-work-location"),
    previewOpenSlots: document.getElementById("requestor-job-posting-preview-open-slots"),
    previewPlantilla: document.getElementById("requestor-job-posting-preview-plantilla"),
    previewRequestor: document.getElementById("requestor-job-posting-preview-requestor"),
    previewPreparedBy: document.getElementById("requestor-job-posting-preview-prepared-by"),
    previewPublishWindow: document.getElementById("requestor-job-posting-preview-publish-window"),
    previewSummary: document.getElementById("requestor-job-posting-preview-summary"),
    previewDescription: document.getElementById("requestor-job-posting-preview-description"),
    previewQualifications: document.getElementById("requestor-job-posting-preview-qualifications"),
    previewProgress: document.getElementById("requestor-job-posting-preview-progress"),
    previewActionWrap: document.getElementById("requestor-job-posting-preview-action-wrap"),
    previewApproveButton: document.getElementById("requestor-job-posting-preview-approve-btn"),
    previewRejectButton: document.getElementById("requestor-job-posting-preview-reject-btn"),
};

const requestorHiringRequestModalElement = document.getElementById("requestorHiringRequestModal");
const requestorHiringRequestModal = requestorHiringRequestModalElement
    ? new bootstrap.Modal(requestorHiringRequestModalElement)
    : null;
const requestorRecruitmentDecisionModalElement = document.getElementById("requestorRecruitmentDecisionModal");
const requestorRecruitmentDecisionModal = requestorRecruitmentDecisionModalElement
    ? new bootstrap.Modal(requestorRecruitmentDecisionModalElement)
    : null;
const requestorJobPostingPreviewModalElement = document.getElementById("requestorJobPostingPreviewModal");
const requestorJobPostingPreviewModal = requestorJobPostingPreviewModalElement
    ? new bootstrap.Modal(requestorJobPostingPreviewModalElement)
    : null;

const requestorPortalState = {
    decision: {
        endpoint: null,
        targetStatus: null,
        successMessage: "",
    },
    postingCache: new Map(),
    activePostingReview: null,
};

let requestorMyRequestsTable;
let requestorHiringApprovalsTable;
let requestorJobPostingReviewsTable;

function requestorEscapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function requestorFormatMultilineText(value, emptyMessage = "Not provided.") {
    const normalized = String(value ?? "").trim();
    if (!normalized) {
        return requestorEscapeHtml(emptyMessage);
    }

    return requestorEscapeHtml(normalized).replace(/\n/g, "<br>");
}

function requestorBuildActionButton(action, label, className = "btn btn-sm btn-outline-primary") {
    return `<button type="button" class="${className}" data-action="${requestorEscapeHtml(action)}">${requestorEscapeHtml(label)}</button>`;
}

function requestorMakeStatusBadge(value, label) {
    const tone = requestorStatusToneMap[value] || "secondary";
    return `<span class="badge bg-${tone}-subtle text-${tone}">${requestorEscapeHtml(label || value || "Unknown")}</span>`;
}

function requestorStatusBadgeFormatter(field, labelField) {
    return cell => {
        const rowData = cell.getRow().getData();
        return requestorMakeStatusBadge(rowData[field], rowData[labelField]);
    };
}

function requestorFormatDateValue(value) {
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

function requestorFormatDateTimeValue(value) {
    if (!value) {
        return "";
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return String(value);
    }

    return parsed.toLocaleString();
}

function requestorFormatPublishWindow(posting) {
    const start = requestorFormatDateTimeValue(posting.publish_start);
    const end = requestorFormatDateTimeValue(posting.publish_end);

    if (start && end) {
        return `${start} to ${end}`;
    }

    return start || end || "Not scheduled.";
}

function requestorNormalizeIntegerValue(value) {
    if (value === "" || value === null || value === undefined) {
        return null;
    }

    const parsed = parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
}

function requestorGetOptionLabel(option, fallbackKey = "name") {
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

function requestorSetSelectOptions(select, options, {
    placeholder = "Select an option",
    selectedValue = "",
    allowBlank = true,
} = {}) {
    if (!select) {
        return;
    }

    const normalizedSelectedValue = selectedValue === null || selectedValue === undefined
        ? ""
        : String(selectedValue);
    const optionMarkup = [];

    if (allowBlank) {
        optionMarkup.push(`<option value="">${requestorEscapeHtml(placeholder)}</option>`);
    }

    options.forEach(option => {
        const value = String(option.id);
        const selectedAttr = value === normalizedSelectedValue ? " selected" : "";
        optionMarkup.push(
            `<option value="${requestorEscapeHtml(value)}"${selectedAttr}>${requestorEscapeHtml(requestorGetOptionLabel(option))}</option>`
        );
    });

    select.innerHTML = optionMarkup.join("");
}

function requestorGetMatchingPlantillaItems(divisionId, positionId) {
    return (requestorRecruitmentOptions.plantilla_items || []).filter(item => {
        const divisionMatches = !divisionId || String(item.division_id) === String(divisionId);
        const positionMatches = !positionId || String(item.position_id) === String(positionId);
        return divisionMatches && positionMatches;
    });
}

function requestorSyncHiringRequestPlantillaOptions(selectedValue = "") {
    requestorSetSelectOptions(
        requestorPortalElements.plantillaInput,
        requestorGetMatchingPlantillaItems(
            requestorPortalElements.divisionInput?.value,
            requestorPortalElements.positionInput?.value
        ),
        {
            placeholder: "No plantilla item selected",
            selectedValue,
        }
    );
}

function requestorPopulateLookupSelects() {
    requestorSetSelectOptions(
        requestorPortalElements.divisionInput,
        requestorRecruitmentOptions.divisions || [],
        { placeholder: "Select division" }
    );
    requestorSetSelectOptions(
        requestorPortalElements.positionInput,
        requestorRecruitmentOptions.positions || [],
        { placeholder: "Select position" }
    );
}

function requestorPopulateRequestorRoles(selectedValue = "") {
    requestorSetSelectOptions(
        requestorPortalElements.requestorRoleInput,
        requestorRecruitmentPermissions.available_requestor_roles || [],
        {
            placeholder: "Select requestor role",
            selectedValue,
            allowBlank: false,
        }
    );
}

async function requestorApiRequest(url, {
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

function requestorNormalizeArrayResponse(response) {
    if (Array.isArray(response)) {
        return response;
    }

    if (Array.isArray(response?.results)) {
        return response.results;
    }

    return [];
}

function requestorMatchAnySearch(data, params) {
    const searchTerm = String(params.term || "").toLowerCase();
    return Object.values(data || {}).some(value =>
        String(value ?? "").toLowerCase().includes(searchTerm)
    );
}

function requestorBindTableSearch(input, table) {
    if (!input || !table) {
        return;
    }

    input.addEventListener("input", event => {
        const value = event.target.value.trim().toLowerCase();
        if (!value) {
            table.clearFilter();
            return;
        }

        table.setFilter(requestorMatchAnySearch, { term: value });
    });
}

function requestorRefreshAllTables() {
    [requestorMyRequestsTable, requestorHiringApprovalsTable, requestorJobPostingReviewsTable]
        .filter(Boolean)
        .forEach(table => table.replaceData());
}

function requestorShowSuccess(message) {
    if (typeof showSystemToast === "function") {
        showSystemToast({
            title: "Updated",
            message,
            tone: "success",
        });
        return;
    }

    alert(message);
}

function requestorCanManageRequestRow(rowData) {
    return rowData.requestor_username === requestorRecruitmentPermissions.username;
}

function requestorGetMyHiringRequestActions(rowData) {
    const actions = [];
    const editableStatuses = ["draft", "rejected", "cancelled"];

    if (requestorCanManageRequestRow(rowData) && editableStatuses.includes(rowData.status)) {
        actions.push(requestorBuildActionButton("edit", "Edit"));
        actions.push(requestorBuildActionButton("submit", "Submit", "btn btn-sm btn-primary"));
    }

    if (
        requestorCanManageRequestRow(rowData)
        && !["approved", "cancelled"].includes(rowData.status)
    ) {
        actions.push(requestorBuildActionButton("cancel", "Cancel", "btn btn-sm btn-outline-danger"));
    }

    return actions.length
        ? `<div class="d-flex flex-wrap gap-1">${actions.join("")}</div>`
        : '<span class="text-muted small">No actions</span>';
}

function requestorGetApprovalActions(rowData) {
    if (rowData.status !== "pending") {
        return '<span class="text-muted small">No actions</span>';
    }

    return `<div class="d-flex flex-wrap gap-1">
        ${requestorBuildActionButton("approve", "Approve", "btn btn-sm btn-success")}
        ${requestorBuildActionButton("reject", "Reject", "btn btn-sm btn-outline-danger")}
    </div>`;
}

function requestorGetPostingReviewActions(rowData) {
    const actions = [
        requestorBuildActionButton("view", "View", "btn btn-sm btn-outline-primary"),
    ];

    if (rowData.status === "pending") {
        actions.push(requestorBuildActionButton("approve", "Approve", "btn btn-sm btn-success"));
        actions.push(requestorBuildActionButton("reject", "Reject", "btn btn-sm btn-outline-danger"));
    }

    return `<div class="d-flex flex-wrap gap-1">${actions.join("")}</div>`;
}

function requestorResetHiringRequestForm(record = null) {
    if (!requestorPortalElements.form) {
        return;
    }

    requestorPortalElements.form.reset();
    requestorPortalElements.requestIdInput.value = record?.hiring_request_id || "";
    requestorPortalElements.modalTitle.textContent = record
        ? `Edit Hiring Request ${record.request_no || ""}`.trim()
        : "New Hiring Request";

    requestorPopulateRequestorRoles(
        record?.requestor_role || requestorRecruitmentPermissions.available_requestor_roles?.[0]?.id || ""
    );
    requestorPopulateLookupSelects();

    requestorSetSelectOptions(
        requestorPortalElements.divisionInput,
        requestorRecruitmentOptions.divisions || [],
        {
            placeholder: "Select division",
            selectedValue: record?.division || "",
        }
    );
    requestorSetSelectOptions(
        requestorPortalElements.positionInput,
        requestorRecruitmentOptions.positions || [],
        {
            placeholder: "Select position",
            selectedValue: record?.position || "",
        }
    );
    requestorSyncHiringRequestPlantillaOptions(record?.plantilla_item || "");

    requestorPortalElements.requestorRoleInput.disabled = Boolean(record);
    requestorPortalElements.headcountInput.value = record?.headcount_requested ?? 1;
    requestorPortalElements.startDateInput.value = record?.target_start_date || "";
    requestorPortalElements.employmentTypeInput.value = record?.employment_type || "";
    requestorPortalElements.reasonInput.value = record?.hiring_reason || "";
    requestorPortalElements.justificationInput.value = record?.justification || "";

    const canSubmit = !record || ["draft", "rejected", "cancelled"].includes(record.status);
    requestorPortalElements.saveDraftButton.textContent = record ? "Save Changes" : "Save Draft";
    requestorPortalElements.submitButton.classList.toggle("d-none", !canSubmit);
}

function requestorOpenHiringRequestModal(record = null) {
    requestorResetHiringRequestForm(record);
    requestorHiringRequestModal?.show();
}

function requestorCollectHiringRequestPayload() {
    return {
        requestor_role: requestorPortalElements.requestorRoleInput.value,
        division: requestorNormalizeIntegerValue(requestorPortalElements.divisionInput.value),
        position: requestorNormalizeIntegerValue(requestorPortalElements.positionInput.value),
        plantilla_item: requestorNormalizeIntegerValue(requestorPortalElements.plantillaInput.value),
        headcount_requested: requestorNormalizeIntegerValue(requestorPortalElements.headcountInput.value),
        employment_type: requestorPortalElements.employmentTypeInput.value.trim(),
        target_start_date: requestorPortalElements.startDateInput.value,
        hiring_reason: requestorPortalElements.reasonInput.value.trim(),
        justification: requestorPortalElements.justificationInput.value.trim(),
    };
}

async function requestorSaveHiringRequest(targetStatus = null) {
    if (!requestorPortalElements.form || !requestorPortalElements.form.reportValidity()) {
        return;
    }

    const requestId = requestorPortalElements.requestIdInput.value;
    const payload = requestorCollectHiringRequestPayload();
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

    await requestorApiRequest(url, {
        method,
        payload,
        fallbackMessage: "Unable to save the hiring request.",
    });

    requestorHiringRequestModal?.hide();
    requestorRefreshAllTables();
    requestorShowSuccess(successMessage);
}

function requestorOpenDecisionModal({
    endpoint,
    title,
    summary,
    targetStatus,
    confirmLabel,
    confirmClass,
    successMessage,
}) {
    requestorPortalState.decision.endpoint = endpoint;
    requestorPortalState.decision.targetStatus = targetStatus;
    requestorPortalState.decision.successMessage = successMessage;

    requestorPortalElements.decisionTitle.textContent = title;
    requestorPortalElements.decisionSummary.textContent = summary;
    requestorPortalElements.decisionNotes.value = "";
    requestorPortalElements.decisionConfirmButton.textContent = confirmLabel;
    requestorPortalElements.decisionConfirmButton.className = confirmClass;

    requestorRecruitmentDecisionModal?.show();
}

async function requestorSubmitDecision() {
    const { endpoint, targetStatus, successMessage } = requestorPortalState.decision;
    if (!endpoint || !targetStatus) {
        return;
    }

    await requestorApiRequest(endpoint, {
        method: "PATCH",
        payload: {
            status: targetStatus,
            decision_notes: requestorPortalElements.decisionNotes.value.trim(),
        },
        fallbackMessage: "Unable to record the decision.",
    });

    requestorRecruitmentDecisionModal?.hide();
    requestorRefreshAllTables();
    requestorShowSuccess(successMessage || "Decision recorded.");
}

async function requestorGetJobPostingRecord(jobPostingId) {
    const cacheKey = String(jobPostingId);
    if (requestorPortalState.postingCache.has(cacheKey)) {
        return requestorPortalState.postingCache.get(cacheKey);
    }

    const posting = await requestorApiRequest(`/api/job-postings/${jobPostingId}/`, {
        fallbackMessage: "Unable to load the job posting details.",
    });
    requestorPortalState.postingCache.set(cacheKey, posting);
    return posting;
}

function requestorRenderPreviewValue(element, value, emptyValue = "-") {
    if (!element) {
        return;
    }

    const normalized = String(value ?? "").trim();
    element.textContent = normalized || emptyValue;
}

function requestorRenderPostingPreview(posting, approvalRecord) {
    requestorPortalState.activePostingReview = approvalRecord;

    requestorPortalElements.previewTitle.textContent = posting.posting_no
        ? `${posting.posting_no} - ${posting.job_title || "Job Posting"}`
        : (posting.job_title || "Job Posting Review");
    requestorPortalElements.previewSubtitle.textContent = [
        posting.division_name,
        posting.position_name,
    ].filter(Boolean).join(" | ");
    requestorPortalElements.previewStatus.innerHTML = requestorMakeStatusBadge(
        posting.status,
        posting.status_label
    );
    requestorPortalElements.previewPortalStatus.innerHTML = requestorMakeStatusBadge(
        posting.portal_status,
        posting.portal_status_label
    );
    requestorRenderPreviewValue(requestorPortalElements.previewDivision, posting.division_name);
    requestorRenderPreviewValue(requestorPortalElements.previewPosition, posting.position_name);
    requestorRenderPreviewValue(requestorPortalElements.previewEmploymentType, posting.employment_type);
    requestorRenderPreviewValue(
        requestorPortalElements.previewWorkLocation,
        posting.work_location,
        "Not specified."
    );
    requestorRenderPreviewValue(requestorPortalElements.previewOpenSlots, posting.open_slots, "0");
    requestorRenderPreviewValue(
        requestorPortalElements.previewPlantilla,
        posting.plantilla_item_number,
        "Not linked."
    );
    requestorRenderPreviewValue(requestorPortalElements.previewRequestor, posting.requestor_name);
    requestorRenderPreviewValue(
        requestorPortalElements.previewPreparedBy,
        posting.prepared_by_hr_username,
        "Not recorded."
    );
    requestorRenderPreviewValue(
        requestorPortalElements.previewPublishWindow,
        requestorFormatPublishWindow(posting)
    );
    requestorPortalElements.previewSummary.innerHTML = requestorFormatMultilineText(
        posting.job_summary,
        "No job summary provided."
    );
    requestorPortalElements.previewDescription.innerHTML = requestorFormatMultilineText(
        posting.job_description,
        "No job description provided."
    );
    requestorPortalElements.previewQualifications.innerHTML = requestorFormatMultilineText(
        posting.qualifications,
        "No qualification notes provided."
    );
    requestorRenderPreviewValue(requestorPortalElements.previewProgress, posting.approval_progress, "");
    requestorPortalElements.previewActionWrap.classList.toggle(
        "d-none",
        approvalRecord.status !== "pending"
    );
}

async function requestorOpenPostingPreview(approvalRecord) {
    const posting = await requestorGetJobPostingRecord(approvalRecord.job_posting);
    requestorRenderPostingPreview(posting, approvalRecord);
    requestorJobPostingPreviewModal?.show();
}

function requestorOpenHiringApprovalDecision(rowData, isApprove) {
    requestorOpenDecisionModal({
        endpoint: `/api/hiring-request-approvals/${rowData.hiring_request_approval_id}/`,
        title: isApprove ? "Approve hiring request" : "Reject hiring request",
        summary: `${rowData.request_no} - ${rowData.position_name} - ${rowData.division_name}`,
        targetStatus: isApprove ? "approved" : "rejected",
        confirmLabel: isApprove ? "Approve" : "Reject",
        confirmClass: isApprove ? "btn btn-success" : "btn btn-danger",
        successMessage: isApprove ? "Hiring request approved." : "Hiring request rejected.",
    });
}

function requestorOpenPostingReviewDecision(rowData, isApprove) {
    requestorJobPostingPreviewModal?.hide();
    requestorOpenDecisionModal({
        endpoint: `/api/job-posting-approvals/${rowData.job_posting_approval_id}/`,
        title: isApprove ? "Approve job posting" : "Reject job posting",
        summary: `${rowData.posting_no} - ${rowData.job_title} - ${rowData.division_name}`,
        targetStatus: isApprove ? "approved" : "rejected",
        confirmLabel: isApprove ? "Approve" : "Reject",
        confirmClass: isApprove ? "btn btn-success" : "btn btn-danger",
        successMessage: isApprove ? "Job posting review recorded." : "Job posting rejected.",
    });
}

function requestorCreateMyRequestsTable() {
    requestorMyRequestsTable = new Tabulator("#requestor-my-hiring-requests-table", {
        layout: "fitColumns",
        height: "520px",
        index: "hiring_request_id",
        ajaxURL: "/api/hiring-requests/",
        ajaxResponse: (url, params, response) => {
            return requestorNormalizeArrayResponse(response).filter(record =>
                record.requestor_username === requestorRecruitmentPermissions.username
            );
        },
        pagination: "local",
        paginationSize: 10,
        placeholder: "No hiring requests found",
        columns: [
            { title: "Request No.", field: "request_no", width: 150 },
            { title: "Role", field: "requestor_role_label", width: 160 },
            { title: "Division", field: "division_name", minWidth: 170 },
            { title: "Position", field: "position_name", minWidth: 170 },
            { title: "Headcount", field: "headcount_requested", width: 110, hozAlign: "center" },
            { title: "Type", field: "employment_type", minWidth: 130 },
            {
                title: "Status",
                field: "status",
                width: 170,
                formatter: requestorStatusBadgeFormatter("status", "status_label"),
            },
            {
                title: "Current Step",
                field: "current_approval_role_label",
                minWidth: 180,
                formatter: cell => requestorEscapeHtml(cell.getValue() || "-"),
            },
            {
                title: "Target Start",
                field: "target_start_date",
                width: 130,
                formatter: cell => requestorEscapeHtml(requestorFormatDateValue(cell.getValue()) || "-"),
            },
            {
                title: "Actions",
                field: "actions",
                minWidth: 240,
                headerSort: false,
                formatter: cell => requestorGetMyHiringRequestActions(cell.getRow().getData()),
                cellClick: async (event, cell) => {
                    const actionButton = event.target.closest("[data-action]");
                    if (!actionButton) {
                        return;
                    }

                    const rowData = cell.getRow().getData();
                    const action = actionButton.dataset.action;

                    try {
                        if (action === "edit") {
                            requestorOpenHiringRequestModal(rowData);
                            return;
                        }

                        if (action === "submit") {
                            const confirmed = await showSystemConfirm(
                                `Submit hiring request ${rowData.request_no}?`,
                                {
                                    title: "Submit hiring request?",
                                    confirmLabel: "Submit",
                                    tone: "primary",
                                }
                            );
                            if (!confirmed) {
                                return;
                            }

                            await requestorApiRequest(`/api/hiring-requests/${rowData.hiring_request_id}/`, {
                                method: "PATCH",
                                payload: { status: "submitted" },
                                fallbackMessage: "Unable to submit the hiring request.",
                            });
                            requestorRefreshAllTables();
                            requestorShowSuccess("Hiring request submitted.");
                            return;
                        }

                        if (action === "cancel") {
                            const confirmed = await showSystemConfirm(
                                `Cancel hiring request ${rowData.request_no}?`,
                                {
                                    title: "Cancel hiring request?",
                                    confirmLabel: "Cancel request",
                                    tone: "warning",
                                }
                            );
                            if (!confirmed) {
                                return;
                            }

                            await requestorApiRequest(`/api/hiring-requests/${rowData.hiring_request_id}/`, {
                                method: "PATCH",
                                payload: { status: "cancelled" },
                                fallbackMessage: "Unable to cancel the hiring request.",
                            });
                            requestorRefreshAllTables();
                            requestorShowSuccess("Hiring request cancelled.");
                        }
                    } catch (error) {
                        showSystemToast({
                            title: "Update Failed",
                            message: error.message,
                            tone: "danger",
                        });
                    }
                },
            },
        ],
    });
}

function requestorCreateHiringApprovalsTable() {
    requestorHiringApprovalsTable = new Tabulator("#requestor-hiring-approvals-table", {
        layout: "fitColumns",
        height: "520px",
        index: "hiring_request_approval_id",
        ajaxURL: "/api/hiring-request-approvals/",
        ajaxResponse: (url, params, response) => requestorNormalizeArrayResponse(response),
        pagination: "local",
        paginationSize: 10,
        placeholder: "No hiring approvals assigned",
        columns: [
            { title: "Request No.", field: "request_no", width: 150 },
            { title: "Approver Role", field: "approver_role_label", minWidth: 160 },
            { title: "Requestor", field: "requestor_username", minWidth: 150 },
            { title: "Division", field: "division_name", minWidth: 170 },
            { title: "Position", field: "position_name", minWidth: 170 },
            { title: "Headcount", field: "headcount_requested", width: 110, hozAlign: "center" },
            {
                title: "Status",
                field: "status",
                width: 150,
                formatter: requestorStatusBadgeFormatter("status", "status_label"),
            },
            {
                title: "Acted At",
                field: "acted_at",
                minWidth: 170,
                formatter: cell => requestorEscapeHtml(requestorFormatDateTimeValue(cell.getValue()) || "-"),
            },
            {
                title: "Actions",
                field: "actions",
                minWidth: 200,
                headerSort: false,
                formatter: cell => requestorGetApprovalActions(cell.getRow().getData()),
                cellClick: (event, cell) => {
                    const actionButton = event.target.closest("[data-action]");
                    if (!actionButton) {
                        return;
                    }

                    const rowData = cell.getRow().getData();
                    requestorOpenHiringApprovalDecision(
                        rowData,
                        actionButton.dataset.action === "approve"
                    );
                },
            },
        ],
    });
}

function requestorCreateJobPostingReviewsTable() {
    requestorJobPostingReviewsTable = new Tabulator("#requestor-job-posting-reviews-table", {
        layout: "fitColumns",
        height: "520px",
        index: "job_posting_approval_id",
        ajaxURL: "/api/job-posting-approvals/",
        ajaxResponse: (url, params, response) => requestorNormalizeArrayResponse(response),
        pagination: "local",
        paginationSize: 10,
        placeholder: "No job posting reviews assigned",
        columns: [
            { title: "Posting No.", field: "posting_no", width: 150 },
            { title: "Job Title", field: "job_title", minWidth: 200 },
            { title: "Division", field: "division_name", minWidth: 170 },
            { title: "Position", field: "position_name", minWidth: 170 },
            {
                title: "Posting Status",
                field: "posting_status",
                minWidth: 180,
                formatter: requestorStatusBadgeFormatter("posting_status", "posting_status_label"),
            },
            {
                title: "Review Status",
                field: "status",
                width: 160,
                formatter: requestorStatusBadgeFormatter("status", "status_label"),
            },
            {
                title: "Acted At",
                field: "acted_at",
                minWidth: 170,
                formatter: cell => requestorEscapeHtml(requestorFormatDateTimeValue(cell.getValue()) || "-"),
            },
            {
                title: "Actions",
                field: "actions",
                minWidth: 240,
                headerSort: false,
                formatter: cell => requestorGetPostingReviewActions(cell.getRow().getData()),
                cellClick: async (event, cell) => {
                    const actionButton = event.target.closest("[data-action]");
                    if (!actionButton) {
                        return;
                    }

                    const rowData = cell.getRow().getData();
                    const action = actionButton.dataset.action;

                    try {
                        if (action === "view") {
                            await requestorOpenPostingPreview(rowData);
                            return;
                        }

                        requestorOpenPostingReviewDecision(rowData, action === "approve");
                    } catch (error) {
                        showSystemToast({
                            title: "Load Failed",
                            message: error.message,
                            tone: "danger",
                        });
                    }
                },
            },
        ],
    });
}

function requestorBindLookupEvents() {
    requestorPortalElements.divisionInput?.addEventListener("change", () => {
        requestorSyncHiringRequestPlantillaOptions();
    });
    requestorPortalElements.positionInput?.addEventListener("change", () => {
        requestorSyncHiringRequestPlantillaOptions();
    });
}

function requestorBindToolbarEvents() {
    requestorPortalElements.refreshAllButton?.addEventListener("click", () => {
        window.location.reload();
    });
    requestorPortalElements.refreshMyRequestsButton?.addEventListener("click", () => {
        requestorMyRequestsTable?.replaceData();
    });
    requestorPortalElements.refreshHiringApprovalsButton?.addEventListener("click", () => {
        requestorHiringApprovalsTable?.replaceData();
    });
    requestorPortalElements.refreshJobPostingReviewsButton?.addEventListener("click", () => {
        requestorJobPostingReviewsTable?.replaceData();
    });
    requestorPortalElements.addHiringRequestButton?.addEventListener("click", () => {
        requestorOpenHiringRequestModal();
    });
}

function requestorBindFormEvents() {
    requestorPortalElements.saveDraftButton?.addEventListener("click", async event => {
        event.preventDefault();
        try {
            await requestorSaveHiringRequest();
        } catch (error) {
            showSystemToast({
                title: "Save Failed",
                message: error.message,
                tone: "danger",
            });
        }
    });

    requestorPortalElements.form?.addEventListener("submit", async event => {
        event.preventDefault();
        try {
            await requestorSaveHiringRequest("submitted");
        } catch (error) {
            showSystemToast({
                title: "Submission Failed",
                message: error.message,
                tone: "danger",
            });
        }
    });

    requestorPortalElements.decisionConfirmButton?.addEventListener("click", async () => {
        try {
            await requestorSubmitDecision();
        } catch (error) {
            showSystemToast({
                title: "Decision Failed",
                message: error.message,
                tone: "danger",
            });
        }
    });

    requestorPortalElements.previewApproveButton?.addEventListener("click", () => {
        if (!requestorPortalState.activePostingReview) {
            return;
        }

        requestorOpenPostingReviewDecision(requestorPortalState.activePostingReview, true);
    });

    requestorPortalElements.previewRejectButton?.addEventListener("click", () => {
        if (!requestorPortalState.activePostingReview) {
            return;
        }

        requestorOpenPostingReviewDecision(requestorPortalState.activePostingReview, false);
    });
}

function requestorActivateTabFromHash() {
    const hash = window.location.hash;
    if (!hash) {
        return;
    }

    const tabTrigger = document.querySelector(
        `#requestorRecruitmentTabs [data-bs-toggle="tab"][data-bs-target="${hash}"]`
    );
    if (!tabTrigger) {
        return;
    }

    bootstrap.Tab.getOrCreateInstance(tabTrigger).show();
}

function requestorBindTabHashSync() {
    const tabTriggers = document.querySelectorAll(
        "#requestorRecruitmentTabs [data-bs-toggle='tab']"
    );
    tabTriggers.forEach(tabTrigger => {
        tabTrigger.addEventListener("shown.bs.tab", event => {
            const targetHash = event.target.getAttribute("data-bs-target");
            if (!targetHash) {
                return;
            }
            history.replaceState(null, "", targetHash);
        });
    });

    window.addEventListener("hashchange", requestorActivateTabFromHash);
    requestorActivateTabFromHash();
}

function initializeRequestorRecruitmentPortal() {
    if (!requestorPortalElements.form) {
        return;
    }

    requestorPopulateLookupSelects();
    requestorPopulateRequestorRoles(
        requestorRecruitmentPermissions.available_requestor_roles?.[0]?.id || ""
    );
    requestorSyncHiringRequestPlantillaOptions();
    requestorBindLookupEvents();

    requestorCreateMyRequestsTable();
    requestorCreateHiringApprovalsTable();
    requestorCreateJobPostingReviewsTable();

    requestorBindTableSearch(requestorPortalElements.myRequestsSearch, requestorMyRequestsTable);
    requestorBindTableSearch(requestorPortalElements.hiringApprovalsSearch, requestorHiringApprovalsTable);
    requestorBindTableSearch(requestorPortalElements.jobPostingReviewsSearch, requestorJobPostingReviewsTable);

    requestorBindToolbarEvents();
    requestorBindFormEvents();
    requestorBindTabHashSync();
}

initializeRequestorRecruitmentPortal();
