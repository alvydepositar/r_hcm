function approverColumns(type) {
    return [
        {
            formatter: "rowSelection",
            titleFormatter: "rowSelection",
            hozAlign: "left",
            headerSort: false,
            width: 50
        },
        {
            title: type === "division" ? "Division" : "Employee",
            field: type === "division" ? "division_id" : "employee_id",
            formatter: cell => type === "division" 
                ? cell.getRow().getData().division_name 
                : cell.getRow().getData().employee_name, 
            headerSort: true,
            width: 300,
        },
        {
            title: "Immediate Supervisor",
            field: "immediate_supervisor",
            editable: true,
            formatter: cell => {
                const id = cell.getValue(); 
                return employeeState.lookup.get(String(id)) || ""; 
            },
            editor: "list",
            editorParams: {
                values: employeeState.options,
                valueField: "value",
                labelField: "label",
                clearable: true
            }
        },
        {
            title: "Alt Supervisor",
            field: "alt_supervisor",
            editable: true,
            formatter: cell => {
                const id = cell.getValue();
                return employeeState.lookup.get(String(id)) || "";
            },
            editor: "list",
            editorParams: () => ({
                values: Object.fromEntries(employeeState.options.map(o => [o.value, o.label])),
                clearable: true
            })
        },
        {
            title: "Division Chief",
            field: "division_chief",
            editable: true,
            formatter: cell => {
                const id = cell.getValue();
                return employeeState.lookup.get(String(id)) || "";
            },
            editor: "list",
            editorParams: () => ({
                values: Object.fromEntries(employeeState.options.map(o => [o.value, o.label])),
                clearable: true
            })
        },
        {
            title: "Alt Division Chief",
            field: "alt_division_chief",
            editable: true,
            formatter: cell => {
                const id = cell.getValue();
                return employeeState.lookup.get(String(id)) || "";
            },
            editor: "list",
            editorParams: () => ({
                values: Object.fromEntries(employeeState.options.map(o => [o.value, o.label])),
                clearable: true
            })
        },
        {
            title: "HR Approver",
            field: "hr_approver",
            editable: true,
            formatter: cell => {
                const id = cell.getValue();
                return employeeState.lookup.get(String(id)) || "";
            },
            editor: "list",
            editorParams: () => ({
                values: Object.fromEntries(employeeState.options.map(o => [o.value, o.label])),
                clearable: true
            })
        },
        {
            title: "Alt HR Approver",
            field: "alt_hr_approver",
            editable: true,
            formatter: cell => {
                const id = cell.getValue();
                return employeeState.lookup.get(String(id)) || "";
            },
            editor: "list",
            editorParams: () => ({
                values: Object.fromEntries(employeeState.options.map(o => [o.value, o.label])),
                clearable: true
            })
        },
        {
            title: "Actions",
            headerSort: false,
            formatter: () =>
                `<button class="btn btn-sm btn-danger">Delete</button>`,
            cellClick: (e, cell) => deleteApprover(cell.getRow())
        }
    ];
}

function patchApprover(id, payload) {
    return fetch(`/api/approvers/${id}/`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
            "X-CSRFToken": csrftoken
        },
        body: JSON.stringify(payload)
    }).then(res => {
        if (!res.ok) throw new Error("Failed to save");
        return res.json();
    });
}

function deleteApprover(row) {
    const data = row.getData();
    if (!confirm("Delete this approver?")) return;

    fetch(`/api/approvers/${data.approver_id}/`, {
        method: "DELETE",
        headers: { "X-CSRFToken": csrftoken }
    }).then(res => {
        if (!res.ok) throw new Error("Delete failed");
        row.delete();
    }).catch(err => alert(err.message));
}

let divisionTable, employeeTable;

Promise.all([loadEmployees(), loadDivisions()])
    .then(() => {
        const divisionApproverTable = new tableFactory({
            el: "#division-approvers-table",
            api: {
                list: "/api/approvers/",
                detail: "/api/approvers/"
            },
            primaryKey: "approver_id",

            ajaxResponse: (url, params, response) =>
                response.filter(r => r.approval_type === "division"),

            columns: approverColumns("division"),
            
        });

        const employeeApproverTable = new tableFactory({
            el: "#employee-approvers-table",
            api: {
                list: "/api/approvers/",
                detail: "/api/approvers/"
            },
            primaryKey: "approver_id",

            ajaxResponse: (url, params, response) =>
                response.filter(r => r.approval_type === "employee"),

            columns: approverColumns("employee"),
        });

        divisionTable = divisionApproverTable.create();
        employeeTable = employeeApproverTable.create();

        new tabSearch("table-search", {
            "division-tab": divisionApproverTable,
            "employee-tab": employeeApproverTable
        });
    })
    .catch(err => {
        console.error("Failed to load initial data:", err);
        alert("Failed to load employees or divisions. Approver tables may not function correctly.");
    });

function reloadTables() {
    divisionTable.replaceData();
    employeeTable.replaceData();
}

const modal = new bootstrap.Modal(
    document.getElementById("addApproverModal")
);

document.getElementById("add-approver-btn")
    .addEventListener("click", () => modal.show());

document.getElementById("add-approver-form")
    .addEventListener("submit", e => {
        e.preventDefault();

        const payload = {
            approval_type: document.getElementById("add-approver-type").value,
            division_id: parseInt(document.getElementById("add-division").value) || null,
            employee_id: parseInt(document.getElementById("add-employee").value) || null,
            immediate_supervisor: parseInt(document.getElementById("add-immediate-supervisor").value),
            alt_supervisor: parseInt(document.getElementById("add-alt-supervisor").value) || null,
            division_chief: parseInt(document.getElementById("add-division-chief").value),
            alt_division_chief: parseInt(document.getElementById("add-alt-division-chief").value) || null,
            hr_approver: parseInt(document.getElementById("add-hr-approver").value),
            alt_hr_approver: parseInt(document.getElementById("add-alt-hr-approver").value) || null
        };

        fetch("/api/approvers/", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRFToken": csrftoken
            },
            body: JSON.stringify(payload)
        })
        .then(res => {
            if (!res.ok) throw new Error("Failed to create");
            return res.json();
        })
        .then(() => {
            modal.hide();
            e.target.reset();
            reloadTables();
        })
        .catch(err => alert(err.message));
    });