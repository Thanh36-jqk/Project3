const https = require('https');

const sendEmail = async (options) => {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) throw new Error('SENDGRID_API_KEY is not configured');

    const payload = JSON.stringify({
        personalizations: [{ to: [{ email: options.to }] }],
        from: { email: process.env.EMAIL_FROM, name: 'Apple Store' },
        subject: options.subject,
        content: [{ type: 'text/html', value: options.html }]
    });

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.sendgrid.com',
            path: '/v3/mail/send',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            },
            timeout: 10000
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    console.log(`Email sent successfully to ${options.to}`);
                    resolve();
                } else {
                    reject(new Error(`SendGrid error ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('SendGrid request timed out'));
        });
        req.on('error', reject);
        req.write(payload);
        req.end();
    });
};

module.exports = { sendEmail };
