(function(){
    'use strict';

var url = require('url');
var EventEmitter = require('events').EventEmitter;
var mailer = require('nodemailer');
var smtpTransport = require("nodemailer-smtp-transport");
var ent = require('ent');

module.exports = function (opts) {
    if (typeof opts === 'string') {
        opts = { uri : opts };
    }

    var transport;
    // if (opts.transportType && opts.transportOptions) {
    if ( opts.transportOptions) {
        
        transport = mailer.createTransport(smtpTransport(opts.transportOptions));
        // transport = mailer.createTransport(smtpTransport({
        //     host: "some-smtp-host.com",//YOUR SMTP SERVER ADDRESS",
        //     secureConnection: true,
        //     port: 465,
        //     service: "Gmail",
        //     auth: {
        //         user: 'bilynsg@gmail.com',
        //         pass: 'g0404651'
        //     }
        // }));
    } else {
        console.log("No transport oprtions specified!");
    }

    var reset = new Forgot(opts);

    var self = function (email, cb) {
        var session = reset.generate();
        if (!session) return;

        var uri = session.uri = opts.uri + '?' + session.id;

        transport.sendMail({
            sender  : opts.from || 'nodepasswordreset@localhost',
            to      : email,
            subject : opts.subject || 'Password reset request',
            text : opts.text || "",
            html :  opts.html || [
                'Click this link to reset your password:\r\n',
                '<br>',
                '<a href="' + encodeURI(uri) + '">',
                ent.encode(uri),
                '</a>',
                ''
            ].join('\r\n')
        }, function (error, success) {
            if (error) {
                if (cb.error) cb.error(error);
                delete reset.sessions[session.id];
            } else {
                if(cb.success) cb.success(success)
            }
        });

        return session;
    };

    self.middleware = reset.middleware.bind(reset);

    self.expire = function (id) {
        delete reset.sessions[id];
    };

    return self;
};

function Forgot (opts) {
    this.sessions = opts.sessions || {};
    this.mount = url.parse(opts.uri);
    this.mount.port = this.mount.port || 80;
}

Forgot.prototype.generate = function () {
    var buf = new Buffer(16);
    for (var i = 0; i < buf.length; i++) {
        buf[i] = Math.floor(Math.random() * 256);
    }
    var id = buf.toString('base64');

    var session = this.sessions[id] = new EventEmitter;
    session.id = id;
    return session;
};

Forgot.prototype.middleware = function (req, res, next) {
    if (!next) next = function (err) {
        if (err) res.end(err)
    }


    var u = url.parse('http://' + req.headers.host + req.url);
    u.port = u.port || 80;
    var id = u.query;


    if (u.hostname !== this.mount.hostname
    || parseInt(u.port, 10) !== parseInt(this.mount.port, 10)
    || u.pathname !== this.mount.pathname) {
        next()
    }
    else if (!id) {
        console.log('No auth token specified.');
        res.statusCode = 400;
        next('No auth token specified.');
    }
    else if (!this.sessions[id]) {
        res.statusCode = 410;
        next('auth token expired');
    }
    else {
        console.log('emit request from middleware');
        this.sessions[id].emit('request', req, res);
    }
};

})();
