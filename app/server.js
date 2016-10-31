 
(function(){
  'use strict';

var fs = require('fs');
var express = require('express');
var session		=	require('express-session');
var bodyParser  	= 	require('body-parser');

var app = express();

// parse application/json
app.use(bodyParser.json());                        

// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: true }));


//var app = express.createServer();

app.use(express.static(__dirname));
app.use(session({secret: 'ssshhhhh',saveUninitialized: true,resave: true}));
 

// example nodemailer config here
var forgot = require('./forgot')({
  uri: 'http://localhost:8080/password_reset',
  from: 'password-robot@localhost',
 // transportType: 'SMTP',
   transportOptions: {
    service: "Gmail",
    auth: {
      user: 'XXXXX@gmail.com',
      pass: 'XXXXX'
    }
  }
});


app.use(forgot.middleware);

app.post('/forgot',   function(req, res) {
  var email = req.body.email;
    
  var callback = {
    error: function(err) {
      res.end('Error sending message: ' + err);
    },
    success: function(success) {
      res.end('Check your inbox for a password reset message.');
    }
  };
  var reset = forgot(email, callback);

  reset.on('request', function(req_, res_) {
    console.log('request event emitted from email: ' + email);
    req_.session.email = email;
    req_.session.reset = {
      email: email,
      id: reset.id
    };

    
    fs.createReadStream(__dirname + '/forgot.html').pipe(res_);
    console.log('send forgot.html.');
  });
});

app.post('/reset',  function(req, res) {
  console.log('/reset route.');
  console.log('req.session = ' + req.session);
  console.log('req.session.email = ' + req.session.email);

  for(var key in req.session)
    console.log("req.session." + key);

  if (!req.session.reset) return res.end('reset token not set');

  var password = req.body.password;
  var confirm = req.body.confirm;
  if (password !== confirm) return res.end('passwords do not match');

  // update the user db here

  forgot.expire(req.session.reset.id);
  delete req.session.reset;
  res.end('password reset');
});

app.listen(8080);
console.log('Listening on :8080');
})();

