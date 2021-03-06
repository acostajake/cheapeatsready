const nodemailer = require('nodemailer');
const pug = require('pug');
const juice = require('juice');
const htmlToText = require('html-to-text');
const promisify = require('es6-promisify');

// setup  for mailer
const transport = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    post: process.env.MAIL_PORT,
    auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS
    }
});

// use locally
const generateHtml = (filename, options = {}) => {
    const html = pug.renderFile(
        `${__dirname}/../views/email/${filename}.pug`,
        options
        );
    const withStyles = juice(html);
    return withStyles
};

exports.sendResetPasswordEmail = async (options) => {
    const html = generateHtml(options.filename, options);
    const text = htmlToText.fromString(html)

    const mailOptions = {
        from: `Cheap Eats! <notthehamburglar.com>`,
        to: options.user.email,
        subject: options.subject,
        html,
        text
    };

    // works as callback
    const sendMail = promisify(transport.sendMail, transport)
    return sendMail(mailOptions);
};