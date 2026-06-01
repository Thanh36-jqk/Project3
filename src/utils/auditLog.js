const MAX = 100;
const logs = [];

function pushAudit(action, meta = {}) {
    logs.push({ action, ...meta, timestamp: new Date().toISOString() });
    if (logs.length > MAX) logs.shift();
}

function getAuditLogs() {
    return [...logs].reverse();
}

module.exports = { pushAudit, getAuditLogs };
