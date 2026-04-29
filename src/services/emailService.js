const nodemailer = require('nodemailer');

/**
 * Configure Nodemailer transport
 * Using SendGrid SMTP
 */
const transporter = nodemailer.createTransport({
    host: 'smtp.sendgrid.net',
    port: 587,
    auth: {
        user: 'apikey', // This is the exact string 'apikey'
        pass: process.env.SENDGRID_API_KEY
    }
});

/**
 * Send an email
 * @param {Object} options - Email options
 * @param {string} options.to - Recipient email address
 * @param {string} options.subject - Email subject
 * @param {string} options.html - Email body (HTML format)
 * @returns {Promise<void>}
 */
const sendEmail = async (options) => {
    try {
        const mailOptions = {
            from: `"Apple Store" <${process.env.EMAIL_FROM}>`,
            to: options.to,
            subject: options.subject,
            html: options.html
        };

        const info = await transporter.sendMail(mailOptions);
        console.log(`Email sent successfully to ${options.to}. Message ID: ${info.messageId}`);
    } catch (error) {
        console.error('Error sending email:', error);
        throw error;
    }
};

module.exports = { sendEmail };
