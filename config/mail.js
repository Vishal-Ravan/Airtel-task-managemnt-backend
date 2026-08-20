const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: Number(process.env.MAIL_PORT),
    secure: false,

    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASSWORD
    },

    tls: {
        rejectUnauthorized: false
    }
});

transporter.verify((error, success) => {
    if (error) {
        console.log("SMTP ERROR:", error);
    } else {
        console.log("SMTP SERVER READY");
    }
});

const sendEmail = async ({ to, subject, html }) => {
    await transporter.sendMail({
        from: process.env.MAIL_FROM,
        to,
        subject,
        html
    });
};

module.exports = {
    sendEmail
};