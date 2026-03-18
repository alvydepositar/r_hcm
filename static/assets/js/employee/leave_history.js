const employeeLeaveHistoryState = {
    employee: (window.HCM_PORTAL_CONTEXT && window.HCM_PORTAL_CONTEXT.employee) || null,
    leaveApplications: [],
    leaveCredits: [],
};

const employeeLeaveHistoryStatusLabels = new Map([
    ["submitted", "Submitted"],
    ["approved", "Approved"],
    ["rejected", "Rejected"],
    ["cancelled", "Cancelled"],
]);

const employeeLeaveHistoryElements = {
    page: document.getElementById("employee-leave-history-page") || document,
    refreshButton: document.getElementById("employee-history-refresh-btn"),
    statusBanner: document.getElementById("employee-history-status"),
    filter: document.getElementById("employee-history-filter"),
    search: document.getElementById("employee-history-search"),
    body: document.getElementById("employee-history-body"),
    modalElement: document.getElementById("employeeLeaveHistoryModal"),
    modalLeaveType: document.getElementById("history-modal-leave-type"),
    modalStatus: document.getElementById("history-modal-status"),
    modalDateRange: document.getElementById("history-modal-date-range"),
    modalRequestedUnits: document.getElementById("history-modal-requested-units"),
    modalApprovalStep: document.getElementById("history-modal-approval-step"),
    modalRuleSummary: document.getElementById("history-modal-rule-summary"),
    modalReason: document.getElementById("history-modal-reason"),
    modalDocument: document.getElementById("history-modal-document"),
    modalApplicationDetails: document.getElementById("history-modal-application-details"),
};

let employeeLeaveHistoryModal = null;

function employeeLeaveHistoryEscapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function employeeLeaveHistoryFormatUnits(value) {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? (value || "") : parsed.toFixed(2);
}

function employeeLeaveHistoryFormatDate(value) {
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

function employeeLeaveHistoryFormatDateRange(startDate, endDate) {
    if (!startDate && !endDate) {
        return "-";
    }

    if (startDate === endDate) {
        return employeeLeaveHistoryFormatDate(startDate);
    }

    return `${employeeLeaveHistoryFormatDate(startDate)} to ${employeeLeaveHistoryFormatDate(endDate)}`;
}

function employeeLeaveHistoryFormatPrintDate(value) {
    if (!value) {
        return "";
    }

    const parsed = value instanceof Date
        ? value
        : new Date(
            typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
                ? `${value}T00:00:00`
                : value
        );

    if (Number.isNaN(parsed.valueOf())) {
        return "";
    }

    return `${parsed.getMonth() + 1}/${parsed.getDate()}/${parsed.getFullYear()}`;
}

function employeeLeaveHistoryParseDecimal(value) {
    if (value === null || value === undefined || value === "") {
        return null;
    }

    const parsed = Number.parseFloat(String(value).replace(/[^0-9.-]/g, ""));
    return Number.isNaN(parsed) ? null : parsed;
}

function employeeLeaveHistoryFormatCurrency(value) {
    const parsed = employeeLeaveHistoryParseDecimal(value);
    if (parsed === null) {
        return "";
    }

    return new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    }).format(parsed);
}

function employeeLeaveHistoryGetChoiceLabel(application, fieldKey, value) {
    const schema = application?.rule_snapshot?.application_detail_schema;
    if (!Array.isArray(schema) || !value) {
        return value || "";
    }

    const field = schema.find(item => item.key === fieldKey);
    const choice = field?.choices?.find(item => item.value === value);
    return choice?.label || value;
}

function employeeLeaveHistoryGetApplicationDetail(application, fieldKey) {
    return String(application?.application_details?.[fieldKey] ?? "").trim();
}

function employeeLeaveHistoryGetLeaveCredit(bucketCode) {
    if (!bucketCode) {
        return null;
    }

    return employeeLeaveHistoryState.leaveCredits.find(credit => credit.bucket_code === bucketCode) || null;
}

function employeeLeaveHistoryResolveLeaveTypeKey(application) {
    const normalized = `${application?.leave_code || ""} ${application?.leave_type_name || ""}`.toLowerCase();

    if (normalized.includes("vacation")) {
        return "vacation";
    }
    if (normalized.includes("forced") || normalized.includes("mandatory")) {
        return "forced";
    }
    if (normalized.includes("sick")) {
        return "sick";
    }
    if (normalized.includes("maternity")) {
        return "maternity";
    }
    if (normalized.includes("paternity")) {
        return "paternity";
    }
    if (normalized.includes("special privilege")) {
        return "special_privilege";
    }
    if (normalized.includes("solo parent")) {
        return "solo_parent";
    }
    if (normalized.includes("study")) {
        return "study";
    }
    if (normalized.includes("vawc")) {
        return "vawc";
    }
    if (normalized.includes("rehabilitation")) {
        return "rehabilitation";
    }
    if (normalized.includes("women")) {
        return "women";
    }
    if (normalized.includes("emergency") || normalized.includes("calamity")) {
        return "emergency";
    }
    if (normalized.includes("adoption")) {
        return "adoption";
    }
    if (normalized.includes("terminal")) {
        return "terminal";
    }
    if (normalized.includes("monetization")) {
        return "monetization";
    }
    if (normalized.includes("without pay") || normalized.includes("lwop")) {
        return "without_pay";
    }

    return "other";
}

function employeeLeaveHistoryBuildCreditSnapshot(application) {
    const vacationCredit = employeeLeaveHistoryGetLeaveCredit("vacation");
    const sickCredit = employeeLeaveHistoryGetLeaveCredit("sick");
    const requestedUnits = employeeLeaveHistoryParseDecimal(application?.requested_units) || 0;
    const deductedUnits = employeeLeaveHistoryParseDecimal(application?.deducted_units);
    const appliedUnits = deductedUnits ?? requestedUnits;
    const bucketCode = application?.balance_bucket_code || "";

    const buildColumn = currentBalance => ({
        earned: "",
        less: "",
        balance: currentBalance === null ? "" : employeeLeaveHistoryFormatUnits(currentBalance),
    });

    const vacation = buildColumn(employeeLeaveHistoryParseDecimal(vacationCredit?.current_balance));
    const sick = buildColumn(employeeLeaveHistoryParseDecimal(sickCredit?.current_balance));

    if (!["vacation", "sick"].includes(bucketCode)) {
        return { vacation, sick };
    }

    const target = bucketCode === "vacation" ? vacation : sick;
    const currentBalance = employeeLeaveHistoryParseDecimal(
        bucketCode === "vacation" ? vacationCredit?.current_balance : sickCredit?.current_balance
    );

    if (currentBalance === null) {
        return { vacation, sick };
    }

    if (application.status === "approved") {
        target.earned = employeeLeaveHistoryFormatUnits(currentBalance + appliedUnits);
        target.less = employeeLeaveHistoryFormatUnits(appliedUnits);
        target.balance = employeeLeaveHistoryFormatUnits(currentBalance);
        return { vacation, sick };
    }

    if (application.status === "submitted") {
        target.earned = employeeLeaveHistoryFormatUnits(currentBalance);
        target.less = employeeLeaveHistoryFormatUnits(appliedUnits);
        target.balance = employeeLeaveHistoryFormatUnits(Math.max(currentBalance - appliedUnits, 0));
        return { vacation, sick };
    }

    target.earned = employeeLeaveHistoryFormatUnits(currentBalance);
    target.less = employeeLeaveHistoryFormatUnits(0);
    target.balance = employeeLeaveHistoryFormatUnits(currentBalance);
    return { vacation, sick };
}

function employeeLeaveHistorySetStatus(message, tone = "light") {
    if (!employeeLeaveHistoryElements.statusBanner) {
        return;
    }

    employeeLeaveHistoryElements.statusBanner.className = `leave-portal-status alert alert-${tone} border mb-4`;
    employeeLeaveHistoryElements.statusBanner.textContent = message;
}

function employeeLeaveHistoryBuildStatusBadge(status, label) {
    const badgeClass = {
        submitted: "bg-warning text-dark",
        approved: "bg-success",
        rejected: "bg-danger",
        cancelled: "bg-secondary",
    }[status] || "bg-light text-dark";

    return `<span class="badge ${badgeClass}">${employeeLeaveHistoryEscapeHtml(label || employeeLeaveHistoryStatusLabels.get(status) || status || "-")}</span>`;
}

function employeeLeaveHistoryFindApplication(leaveApplicationId) {
    return employeeLeaveHistoryState.leaveApplications.find(application =>
        String(application.leave_application_id) === String(leaveApplicationId)
    ) || null;
}

function employeeLeaveHistoryBuildActionButtons(application) {
    const iconButton = (className, icon, label) => `
        <button
            class="btn btn-sm btn-outline-secondary hcm-table-action-btn ${className}"
            type="button"
            data-leave-application-id="${employeeLeaveHistoryEscapeHtml(application.leave_application_id)}"
            title="${label}"
            aria-label="${label}"
        >
            <i class="${icon}" aria-hidden="true"></i>
            <span class="visually-hidden">${label}</span>
        </button>
    `;

    return `
        <div class="d-flex gap-1 justify-content-end align-items-center hcm-table-actions">
            ${iconButton("employee-history-view-btn", "ti ti-eye", "View")}
            ${application.status !== "cancelled"
                ? iconButton("employee-history-print-btn", "ti ti-printer", "Print")
                : ""}
            ${application.status === "submitted"
                ? iconButton("employee-history-cancel-btn", "ti ti-x", "Cancel")
                : ""}
        </div>
    `;
}

function employeeLeaveHistoryOpenModal(application) {
    if (!employeeLeaveHistoryModal || !application) {
        return;
    }

    employeeLeaveHistoryElements.modalLeaveType.textContent = application.leave_type_name || formatLeaveTypeReference(application.leave_type);
    employeeLeaveHistoryElements.modalStatus.innerHTML = employeeLeaveHistoryBuildStatusBadge(application.status, application.status_label);
    employeeLeaveHistoryElements.modalDateRange.textContent = employeeLeaveHistoryFormatDateRange(application.start_date, application.end_date);
    employeeLeaveHistoryElements.modalRequestedUnits.textContent = employeeLeaveHistoryFormatUnits(application.requested_units);
    employeeLeaveHistoryElements.modalApprovalStep.textContent = application.current_approval_role_label || "Completed";
    employeeLeaveHistoryElements.modalRuleSummary.textContent = application.entitlement_summary || "No rule summary available.";
    employeeLeaveHistoryElements.modalReason.textContent = application.reason || "No reason provided.";
    employeeLeaveHistoryElements.modalDocument.textContent = application.supporting_document_reference
        || application.supporting_document_notes
        || "No supporting document details provided.";
    employeeLeaveHistoryElements.modalApplicationDetails.innerHTML = application.application_detail_summary
        ? employeeLeaveHistoryEscapeHtml(application.application_detail_summary).replace(/\n/g, "<br>")
        : "No leave-specific filing details provided.";

    employeeLeaveHistoryModal.show();
}

function employeeLeaveHistoryBuildPrintMarkup(application) {
    const employee = employeeLeaveHistoryState.employee || {};
    const escape = employeeLeaveHistoryEscapeHtml;
    const leaveTypeKey = employeeLeaveHistoryResolveLeaveTypeKey(application);
    const employeeName = [employee.first_name, employee.middle_name, employee.last_name].filter(Boolean).join(" ").trim();
    const filingDate = employeeLeaveHistoryFormatPrintDate(application.created) || employeeLeaveHistoryFormatPrintDate(new Date());
    const requestedUnits = employeeLeaveHistoryFormatUnits(application.requested_units);
    const statusLabel = application.status_label || employeeLeaveHistoryStatusLabels.get(application.status) || application.status || "-";
    const payStatus = application.rule_snapshot?.pay_status || "";
    const detailSummary = application.application_detail_summary || "";
    const travelScope = employeeLeaveHistoryGetApplicationDetail(application, "travel_scope");
    const travelDestination = employeeLeaveHistoryGetApplicationDetail(application, "travel_destination");
    const medicalContext = employeeLeaveHistoryGetApplicationDetail(application, "medical_context");
    const illnessDetails = employeeLeaveHistoryGetApplicationDetail(application, "illness_details");
    const studyPurpose = employeeLeaveHistoryGetApplicationDetail(application, "study_leave_purpose");
    const studyPurposeLabel = employeeLeaveHistoryGetChoiceLabel(application, "study_leave_purpose", studyPurpose);
    const studyOtherPurpose = employeeLeaveHistoryGetApplicationDetail(application, "study_leave_other_purpose");
    const surgeryDetails = employeeLeaveHistoryGetApplicationDetail(application, "surgery_details");
    const creditSnapshot = employeeLeaveHistoryBuildCreditSnapshot(application);
    const applicantLine = employeeName || " ";
    const officeDepartment = (employee.division_name || "").toUpperCase();
    const positionName = employee.position_name || "";
    const salaryText = "";
    const hasDirectOtherPurpose = ![
        "vacation",
        "special_privilege",
        "sick",
        "study",
        "women",
        "monetization",
        "terminal",
    ].includes(leaveTypeKey);
    const otherPurposeText = hasDirectOtherPurpose
        ? [application.leave_type_name, detailSummary || application.reason].filter(Boolean).join(" - ")
        : (application.reason || "");
    const recommendationForApproval = application.status !== "rejected";
    const recommendationDisapprove = application.status === "rejected";
    const recommendationNote = application.status === "rejected"
        ? "Per recorded workflow decision."
        : "";
    const authorizedOfficer = application.current_approver_name || "";
    const withPayDays = application.status === "approved" && payStatus !== "without_pay" ? requestedUnits : "";
    const withoutPayDays = application.status === "approved" && payStatus === "without_pay" ? requestedUnits : "";
    const otherApprovalText = application.status === "approved" && !withPayDays && !withoutPayDays
        ? `${requestedUnits} (${application.rule_snapshot?.pay_status_label || statusLabel})`
        : "";

    const checkboxRow = (checked, label, value = "", fillClass = "") => `
        <div class="csc-check-row">
            <span class="csc-box">${checked ? "&#10003;" : ""}</span>
            <span class="csc-check-label">${escape(label)}</span>
            <span class="csc-fill ${fillClass}">${escape(value || "")}</span>
        </div>
    `;

    const leaveTypeRows = [
        checkboxRow(leaveTypeKey === "vacation", "Vacation Leave"),
        checkboxRow(leaveTypeKey === "forced", "Mandatory / Forced Leave"),
        checkboxRow(leaveTypeKey === "sick", "Sick Leave"),
        checkboxRow(leaveTypeKey === "maternity", "Maternity Leave"),
        checkboxRow(leaveTypeKey === "paternity", "Paternity Leave"),
        checkboxRow(leaveTypeKey === "special_privilege", "Special Privilege Leave"),
        checkboxRow(leaveTypeKey === "solo_parent", "Solo Parent Leave"),
        checkboxRow(leaveTypeKey === "study", "Study Leave"),
        checkboxRow(leaveTypeKey === "vawc", "10-Day VAWC Leave"),
        checkboxRow(leaveTypeKey === "rehabilitation", "Rehabilitation Privilege"),
        checkboxRow(leaveTypeKey === "women", "Special Leave Benefits for Women"),
        checkboxRow(leaveTypeKey === "emergency", "Special Emergency (Calamity) Leave"),
        checkboxRow(leaveTypeKey === "adoption", "Adoption Leave"),
        checkboxRow(
            leaveTypeKey === "other" || leaveTypeKey === "without_pay",
            "Others",
            leaveTypeKey === "other" || leaveTypeKey === "without_pay" ? application.leave_type_name || "" : ""
        ),
    ].join("");

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <title>Application for Leave ${escape(application.leave_application_id)}</title>
    <style>
        @page {
            size: legal portrait;
            margin: 0.28in;
        }
        :root { color-scheme: light; }
        * { box-sizing: border-box; }
        html, body {
            margin: 0;
            padding: 0;
            background: #fff;
            color: #111;
            font-family: Arial, Helvetica, sans-serif;
        }
        body {
            padding: 8px;
            font-size: 10.5px;
            line-height: 1.25;
        }
        .csc-form {
            max-width: 860px;
            margin: 0 auto;
        }
        .csc-top {
            display: grid;
            grid-template-columns: 140px 1fr 110px;
            gap: 12px;
            align-items: start;
            margin-bottom: 8px;
        }
        .csc-form-note {
            font-size: 11px;
            font-style: italic;
            font-weight: 600;
            white-space: pre-line;
        }
        .csc-title-wrap {
            text-align: center;
            padding-top: 4px;
        }
        .csc-title-wrap__country {
            font-weight: 700;
        }
        .csc-title-wrap__agency {
            font-weight: 800;
            letter-spacing: 0.03em;
            margin-top: 2px;
        }
        .csc-title-wrap__sub {
            font-size: 10px;
            margin-top: 1px;
        }
        .csc-title-wrap h1 {
            margin: 12px 0 0;
            font-size: 18px;
            font-weight: 800;
            letter-spacing: 0.02em;
        }
        .csc-stamp {
            min-height: 64px;
            border: 1px solid #111;
            font-size: 9px;
            padding: 6px;
            text-align: center;
        }
        .csc-block {
            border: 1px solid #111;
            margin-top: -1px;
        }
        .csc-section-title {
            border-bottom: 1px solid #111;
            padding: 3px 8px;
            text-align: center;
            font-size: 12px;
            font-weight: 800;
        }
        .csc-grid {
            display: grid;
        }
        .csc-grid--top {
            grid-template-columns: 1.2fr 2.4fr;
        }
        .csc-grid--meta {
            grid-template-columns: 1.2fr 1.6fr 1fr;
        }
        .csc-grid--split {
            grid-template-columns: 1.18fr 1fr;
        }
        .csc-grid--action {
            grid-template-columns: 1fr 1fr;
        }
        .csc-cell {
            min-width: 0;
            padding: 4px 6px;
            border-left: 1px solid #111;
            border-top: 1px solid #111;
        }
        .csc-grid > .csc-cell:nth-child(1),
        .csc-grid--top > .csc-cell:nth-child(1),
        .csc-grid--meta > .csc-cell:nth-child(1),
        .csc-grid--split > .csc-cell:nth-child(1),
        .csc-grid--action > .csc-cell:nth-child(1) {
            border-left: 0;
        }
        .csc-grid:first-child .csc-cell,
        .csc-grid--top:first-child .csc-cell,
        .csc-grid--meta:first-child .csc-cell,
        .csc-grid--split:first-child .csc-cell,
        .csc-grid--action:first-child .csc-cell {
            border-top: 0;
        }
        .csc-field-label {
            font-size: 10px;
            text-transform: uppercase;
        }
        .csc-field-label--inline {
            display: flex;
            gap: 4px;
            align-items: baseline;
            flex-wrap: wrap;
        }
        .csc-field-number {
            font-weight: 700;
        }
        .csc-field-value {
            min-height: 18px;
            padding: 3px 2px 1px;
            border-bottom: 1px solid #111;
            font-size: 11px;
            font-weight: 700;
        }
        .csc-name-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
            margin-top: 4px;
        }
        .csc-name-hint {
            margin-top: 2px;
            font-size: 9px;
            text-align: center;
        }
        .csc-panel-note {
            margin: 5px 0 6px;
            font-style: italic;
            font-size: 9.4px;
        }
        .csc-checklist {
            display: grid;
            gap: 2px;
            margin-top: 4px;
        }
        .csc-check-row {
            display: grid;
            grid-template-columns: 13px auto 1fr;
            gap: 6px;
            align-items: center;
            min-height: 16px;
        }
        .csc-box {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 11px;
            height: 11px;
            border: 1px solid #111;
            font-size: 10px;
            line-height: 1;
        }
        .csc-check-label {
            min-width: 0;
        }
        .csc-fill {
            min-width: 0;
            min-height: 14px;
            padding: 1px 2px;
            border-bottom: 1px solid #111;
            font-size: 10px;
            font-weight: 600;
        }
        .csc-fill--multiline {
            min-height: 32px;
            white-space: pre-wrap;
            word-break: break-word;
        }
        .csc-subtitle {
            margin-bottom: 4px;
            font-weight: 700;
        }
        .csc-inline-pair {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 8px;
            align-items: center;
            margin-top: 4px;
        }
        .csc-applicant {
            margin-top: 14px;
        }
        .csc-signature-line {
            min-height: 16px;
            border-bottom: 1px solid #111;
            padding: 1px 2px;
            text-align: center;
            font-weight: 700;
        }
        .csc-signature-caption {
            margin-top: 2px;
            text-align: center;
            font-size: 9px;
        }
        .csc-credit-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 8px;
            font-size: 10px;
        }
        .csc-credit-table th,
        .csc-credit-table td {
            border: 1px solid #111;
            padding: 2px 4px;
            text-align: center;
        }
        .csc-credit-table th:first-child,
        .csc-credit-table td:first-child {
            text-align: left;
            font-style: italic;
        }
        .csc-approval-grid {
            display: grid;
            gap: 4px;
            margin-top: 6px;
        }
        .csc-approval-line {
            display: grid;
            grid-template-columns: 52px 1fr;
            gap: 8px;
            align-items: end;
            min-height: 16px;
        }
        .csc-approval-line .csc-fill {
            min-height: 15px;
        }
        .csc-foot-gap {
            min-height: 48px;
        }
        @media print {
            body {
                padding: 0;
            }
        }
    </style>
</head>
<body>
    <div class="csc-form">
        <div class="csc-top">
            <div class="csc-form-note">Civil Service Form No. 6
Revised 2020</div>
            <div class="csc-title-wrap">
                <div class="csc-title-wrap__country">Republic of the Philippines</div>
                <div class="csc-title-wrap__agency">GOVERNMENT HUMAN RESOURCE MANAGEMENT SYSTEM</div>
                <div class="csc-title-wrap__sub">Employee leave filing record</div>
                <h1>APPLICATION FOR LEAVE</h1>
            </div>
            <div class="csc-stamp">Stamp of Date of Receipt</div>
        </div>

        <div class="csc-block">
            <div class="csc-grid csc-grid--top">
                <div class="csc-cell">
                    <div class="csc-field-label--inline"><span class="csc-field-number">1.</span><span>Office / Department</span></div>
                    <div class="csc-field-value">${escape(officeDepartment)}</div>
                </div>
                <div class="csc-cell">
                    <div class="csc-field-label--inline"><span class="csc-field-number">2.</span><span>Name</span></div>
                    <div class="csc-name-grid">
                        <div>
                            <div class="csc-field-value">${escape(employee.last_name || "")}</div>
                            <div class="csc-name-hint">(Last)</div>
                        </div>
                        <div>
                            <div class="csc-field-value">${escape(employee.first_name || "")}</div>
                            <div class="csc-name-hint">(First)</div>
                        </div>
                        <div>
                            <div class="csc-field-value">${escape(employee.middle_name || "")}</div>
                            <div class="csc-name-hint">(Middle)</div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="csc-grid csc-grid--meta">
                <div class="csc-cell">
                    <div class="csc-field-label--inline"><span class="csc-field-number">3.</span><span>Date of Filing</span></div>
                    <div class="csc-field-value">${escape(filingDate)}</div>
                </div>
                <div class="csc-cell">
                    <div class="csc-field-label--inline"><span class="csc-field-number">4.</span><span>Position</span></div>
                    <div class="csc-field-value">${escape(positionName)}</div>
                </div>
                <div class="csc-cell">
                    <div class="csc-field-label--inline"><span class="csc-field-number">5.</span><span>Salary</span></div>
                    <div class="csc-field-value">${escape(salaryText)}</div>
                </div>
            </div>
        </div>

        <div class="csc-block">
            <div class="csc-section-title">6. DETAILS OF APPLICATION</div>
            <div class="csc-grid csc-grid--split">
                <div class="csc-cell">
                    <div class="csc-field-label"><strong>6.A</strong> Type of Leave to be Availed Of</div>
                    <div class="csc-checklist">${leaveTypeRows}</div>
                </div>
                <div class="csc-cell">
                    <div class="csc-field-label"><strong>6.B</strong> Details of Leave</div>
                    <div class="csc-panel-note">In case of Vacation / Special Privilege Leave:</div>
                    <div class="csc-checklist">
                        ${checkboxRow(travelScope === "within_philippines", "Within the Philippines", travelScope === "within_philippines" ? travelDestination : "")}
                        ${checkboxRow(travelScope === "abroad", "Abroad (Specify)", travelScope === "abroad" ? travelDestination : "")}
                    </div>

                    <div class="csc-panel-note">In case of Sick Leave:</div>
                    <div class="csc-checklist">
                        ${checkboxRow(
                            medicalContext === "in_hospital",
                            "In Hospital (Specify Illness)",
                            medicalContext === "in_hospital" ? illnessDetails : ""
                        )}
                        ${checkboxRow(
                            medicalContext === "out_patient",
                            "Out Patient (Specify Illness)",
                            medicalContext === "out_patient" ? illnessDetails : ""
                        )}
                    </div>

                    <div class="csc-panel-note">In case of Special Leave Benefits for Women:</div>
                    <div class="csc-checklist">
                        ${checkboxRow(leaveTypeKey === "women", "Specify illness / surgery", surgeryDetails, "csc-fill--multiline")}
                    </div>

                    <div class="csc-panel-note">In case of Study Leave:</div>
                    <div class="csc-checklist">
                        ${checkboxRow(studyPurpose === "masters_completion", "Completion of Master's Degree")}
                        ${checkboxRow(studyPurpose === "bar_board_review", "BAR / Board Examination Review")}
                        ${checkboxRow(studyPurpose === "other", "Other Purpose", studyPurpose === "other" ? studyOtherPurpose : "")}
                    </div>

                    <div class="csc-panel-note">Other purpose:</div>
                    <div class="csc-checklist">
                        ${checkboxRow(Boolean(otherPurposeText), application.leave_type_name || "Leave details", otherPurposeText, "csc-fill--multiline")}
                        ${checkboxRow(leaveTypeKey === "monetization", "Monetization of Leave Credits")}
                        ${checkboxRow(leaveTypeKey === "terminal", "Terminal Leave")}
                    </div>
                </div>
            </div>
            <div class="csc-grid csc-grid--split">
                <div class="csc-cell">
                    <div class="csc-field-label"><strong>6.C</strong> Number of Working Days / Units Applied For</div>
                    <div class="csc-field-value">${escape(requestedUnits)}</div>
                    <div class="csc-subtitle" style="margin-top:10px;">Inclusive Dates</div>
                    <div class="csc-field-value">${escape(
                        `${employeeLeaveHistoryFormatPrintDate(application.start_date)} - ${employeeLeaveHistoryFormatPrintDate(application.end_date)}`
                    )}</div>
                </div>
                <div class="csc-cell">
                    <div class="csc-field-label"><strong>6.D</strong> Commutation</div>
                    <div class="csc-checklist">
                        ${checkboxRow(true, "Not Requested")}
                        ${checkboxRow(false, "Requested")}
                    </div>
                    <div class="csc-applicant">
                        <div class="csc-signature-line">${escape(applicantLine)}</div>
                        <div class="csc-signature-caption">(Signature of Applicant)</div>
                    </div>
                </div>
            </div>
        </div>

        <div class="csc-block">
            <div class="csc-section-title">7. DETAILS OF ACTION ON APPLICATION</div>
            <div class="csc-grid csc-grid--action">
                <div class="csc-cell">
                    <div class="csc-field-label"><strong>7.A</strong> Certification of Leave Credits</div>
                    <div class="csc-inline-pair">
                        <span>As of</span>
                        <span class="csc-fill">${escape(filingDate)}</span>
                    </div>
                    <table class="csc-credit-table">
                        <thead>
                            <tr>
                                <th></th>
                                <th>Vacation Leave</th>
                                <th>Sick Leave</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td>Total Earned</td>
                                <td>${escape(creditSnapshot.vacation.earned)}</td>
                                <td>${escape(creditSnapshot.sick.earned)}</td>
                            </tr>
                            <tr>
                                <td>Less this application</td>
                                <td>${escape(creditSnapshot.vacation.less)}</td>
                                <td>${escape(creditSnapshot.sick.less)}</td>
                            </tr>
                            <tr>
                                <td>Balance</td>
                                <td>${escape(creditSnapshot.vacation.balance)}</td>
                                <td>${escape(creditSnapshot.sick.balance)}</td>
                            </tr>
                        </tbody>
                    </table>
                    <div class="csc-applicant">
                        <div class="csc-signature-line">${escape(authorizedOfficer)}</div>
                        <div class="csc-signature-caption">(Authorized Officer)</div>
                    </div>
                </div>
                <div class="csc-cell">
                    <div class="csc-field-label"><strong>7.B</strong> Recommendation</div>
                    <div class="csc-checklist">
                        ${checkboxRow(recommendationForApproval, "For approval")}
                        ${checkboxRow(recommendationDisapprove, "For disapproval due to", recommendationNote, "csc-fill--multiline")}
                    </div>
                    <div class="csc-applicant">
                        <div class="csc-signature-line">${escape(authorizedOfficer)}</div>
                        <div class="csc-signature-caption">(Authorized Officer)</div>
                    </div>
                </div>
            </div>
            <div class="csc-grid csc-grid--action">
                <div class="csc-cell">
                    <div class="csc-field-label"><strong>7.C</strong> Approved For</div>
                    <div class="csc-approval-grid">
                        <div class="csc-approval-line"><span>_____</span><span class="csc-fill">${escape(withPayDays)}</span></div>
                        <div>days with pay</div>
                        <div class="csc-approval-line"><span>_____</span><span class="csc-fill">${escape(withoutPayDays)}</span></div>
                        <div>days without pay</div>
                        <div class="csc-approval-line"><span>_____</span><span class="csc-fill">${escape(otherApprovalText)}</span></div>
                        <div>others (Specify)</div>
                    </div>
                </div>
                <div class="csc-cell">
                    <div class="csc-field-label"><strong>7.D</strong> Disapproved Due To</div>
                    <div class="csc-fill csc-fill--multiline" style="margin-top:8px;">${escape(
                        application.status === "rejected" ? recommendationNote || "Rejected in workflow." : ""
                    )}</div>
                    <div class="csc-foot-gap"></div>
                </div>
            </div>
            <div class="csc-cell" style="border-left:0; border-top:1px solid #111;">
                <div class="csc-applicant" style="max-width:240px; margin: 18px auto 0;">
                    <div class="csc-signature-line">${escape(
                        application.status === "approved" ? authorizedOfficer : ""
                    )}</div>
                    <div class="csc-signature-caption">(Authorized Official)</div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>`;
}

function employeeLeaveHistoryPrint(application) {
    if (!application) {
        return;
    }

    if (application.status === "cancelled") {
        showSystemToast({
            title: "Print Unavailable",
            message: "Cancelled leave filings cannot be printed.",
            tone: "warning",
        });
        return;
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
        showSystemToast({
            title: "Print Blocked",
            message: "Allow pop-ups for this site to print the leave filing.",
            tone: "danger",
        });
        return;
    }

    printWindow.opener = null;
    printWindow.document.open();
    printWindow.document.write(employeeLeaveHistoryBuildPrintMarkup(application));
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => {
        printWindow.print();
    }, 250);
}

function employeeLeaveHistoryGetFilteredRows() {
    const searchTerm = employeeLeaveHistoryElements.search?.value.trim().toLowerCase() || "";
    const selectedStatus = employeeLeaveHistoryElements.filter?.value || "";

    return employeeLeaveHistoryState.leaveApplications.filter(application => {
        if (selectedStatus && application.status !== selectedStatus) {
            return false;
        }

        if (!searchTerm) {
            return true;
        }

        const searchableText = [
            application.leave_type_name,
            application.leave_code,
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

function employeeLeaveHistoryRender() {
    if (!employeeLeaveHistoryElements.body) {
        return;
    }

    if (!employeeLeaveHistoryState.employee) {
        employeeLeaveHistoryElements.body.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-4">A linked employee record is required to load leave history.</td>
            </tr>
        `;
        return;
    }

    const rows = employeeLeaveHistoryGetFilteredRows();
    if (!rows.length) {
        employeeLeaveHistoryElements.body.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-4">No leave applications matched the current filters.</td>
            </tr>
        `;
        return;
    }

    employeeLeaveHistoryElements.body.innerHTML = rows.map(application => `
        <tr>
            <td>
                <div class="fw-semibold">${employeeLeaveHistoryEscapeHtml(application.leave_type_name || formatLeaveTypeReference(application.leave_type))}</div>
                <div class="small text-muted">${employeeLeaveHistoryEscapeHtml(application.leave_code || "")}</div>
            </td>
            <td>${employeeLeaveHistoryEscapeHtml(employeeLeaveHistoryFormatDateRange(application.start_date, application.end_date))}</td>
            <td class="text-end">${employeeLeaveHistoryEscapeHtml(employeeLeaveHistoryFormatUnits(application.requested_units))}</td>
            <td>
                ${employeeLeaveHistoryBuildStatusBadge(application.status, application.status_label)}
                ${application.current_approval_role_label
                    ? `<div class="small text-muted mt-1">Current step: ${employeeLeaveHistoryEscapeHtml(application.current_approval_role_label)}</div>`
                    : ""}
            </td>
            <td class="small text-muted">${employeeLeaveHistoryEscapeHtml(application.entitlement_summary || "-")}</td>
            <td>
                <div>${employeeLeaveHistoryEscapeHtml(application.reason || "-")}</div>
                ${application.application_detail_summary
                    ? `<div class="small text-muted mt-1">${employeeLeaveHistoryEscapeHtml(application.application_detail_summary).replace(/\n/g, "<br>")}</div>`
                    : ""}
            </td>
            <td class="text-end">${employeeLeaveHistoryBuildActionButtons(application)}</td>
        </tr>
    `).join("");
}

async function employeeLeaveHistoryLoad() {
    if (!employeeLeaveHistoryState.employee) {
        employeeLeaveHistoryState.leaveApplications = [];
        employeeLeaveHistoryState.leaveCredits = [];
        employeeLeaveHistoryRender();
        employeeLeaveHistorySetStatus("A linked employee record is required before leave history can be loaded.", "danger");
        return;
    }

    employeeLeaveHistorySetStatus("Loading leave history...", "warning");

    const [applicationsResponse, creditsResponse] = await Promise.all([
        fetch("/api/leave-applications/"),
        fetch("/api/leave-credits/"),
    ]);

    if (!applicationsResponse.ok) {
        throw new Error(await readApiError(applicationsResponse, "Failed to load leave history"));
    }

    employeeLeaveHistoryState.leaveApplications = await applicationsResponse.json();
    employeeLeaveHistoryState.leaveCredits = creditsResponse.ok
        ? await creditsResponse.json()
        : [];
    employeeLeaveHistoryRender();
    employeeLeaveHistorySetStatus(
        `Leave history ready for ${employeeLeaveHistoryState.employee.first_name} ${employeeLeaveHistoryState.employee.last_name}.`,
        "success",
    );
}

async function employeeLeaveHistoryCancel(leaveApplicationId) {
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

    await employeeLeaveHistoryLoad();
    showSystemToast({
        title: "Leave Updated",
        message: "The leave application was cancelled.",
        tone: "success",
    });
}

function employeeLeaveHistoryBindEvents() {
    employeeLeaveHistoryElements.filter?.addEventListener("change", employeeLeaveHistoryRender);
    employeeLeaveHistoryElements.search?.addEventListener("input", employeeLeaveHistoryRender);

    employeeLeaveHistoryElements.body?.addEventListener("click", event => {
        const viewButton = event.target.closest(".employee-history-view-btn");
        if (viewButton) {
            const application = employeeLeaveHistoryFindApplication(viewButton.dataset.leaveApplicationId);
            employeeLeaveHistoryOpenModal(application);
            return;
        }

        const printButton = event.target.closest(".employee-history-print-btn");
        if (printButton) {
            const application = employeeLeaveHistoryFindApplication(printButton.dataset.leaveApplicationId);
            employeeLeaveHistoryPrint(application);
            return;
        }

        const cancelButton = event.target.closest(".employee-history-cancel-btn");
        if (!cancelButton) {
            return;
        }

        const leaveApplicationId = cancelButton.dataset.leaveApplicationId;
        if (!leaveApplicationId) {
            return;
        }

        employeeLeaveHistoryCancel(leaveApplicationId).catch(err => {
            showSystemToast({
                title: "Cancellation Failed",
                message: err.message,
                tone: "danger",
            });
        });
    });
}

async function initializeEmployeeLeaveHistory() {
    if (!employeeLeaveHistoryElements.body) {
        return;
    }

    if (employeeLeaveHistoryElements.modalElement) {
        employeeLeaveHistoryModal = new bootstrap.Modal(employeeLeaveHistoryElements.modalElement);
    }

    initializeSearchableSelects(employeeLeaveHistoryElements.page, {
        selector: "select",
        searchPlaceholder: "Search records",
    });

    employeeLeaveHistoryBindEvents();
    await employeeLeaveHistoryLoad();
}

initializeEmployeeLeaveHistory().catch(err => {
    console.error("Failed to initialize employee leave history:", err);
    showSystemToast({
        title: "History Error",
        message: err?.message || "Failed to initialize the leave history page.",
        tone: "danger",
    });
});
