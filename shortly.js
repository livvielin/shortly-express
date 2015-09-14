var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var session = require('express-session');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());


//Cookie parser
app.use(cookieParser('test secret'));
// app.use(function(req, res, next) {
//   var cookie = req.cookies.shortly;
//   if(cookie === undefined) {
//     var randomNumber = Math.random().toFixed(10);
//     randomNumber = randomNumber.substring(2, randomNumber.length);
//     //The duration of the cookie is set below; null means cookie will only
//     //expire when browser is closed; else it should be the number of seconds
//     res.cookie('shortly', randomNumber, { maxAge: null, httpOnly: true });
//     console.log('Cookie created successfully!');
//   }
//   else {
//     console.log('Cookie already exists', cookie);
//   }
//   next();
// });

// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

//Session checking
app.use(session());
app.use(function(req, res, next) {
  if ( (req.url === '/login' || req.url === '/signup') || req.session.user) {
    next();
  }
  else {
    console.log('No session in memory.');
    req.session.error = "Access denied; redirecting to login page.";
    res.redirect('/login');
  }
});


app.get('/', 
function(req, res) {
  res.render('index');
});

app.get('/create', 
function(req, res) {
  res.render('index');
});

app.get('/links', 
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', 
function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        Links.create({
          url: uri,
          title: title,
          base_url: req.headers.origin
        })
        .then(function(newLink) {
          res.send(200, newLink);
        });
      });
    }
  });
});

/************************************************************/
// Write your authentication routes here
/************************************************************/

app.get('/login',
function(req, res) {
  res.render('login');
});

app.post('/login',
function(req, res) {
  var username = req.body.username;
  var password = req.body.password;
  new User({'username': username})
    .fetch()
    .then(function(found) {
      if(found) {
        if(found.checkPassword(password)) {
          req.session.regenerate(function(){
            req.session.user = username;
            res.redirect('/index');
          });
        }
        else {
          console.log('Login credentials do not match; please input login credentials again.');
          res.redirect('/login');
        }
      }
      else {
        console.log('Login not recognized; redirecting to account sign-up page.');
        res.redirect('/signup');
      }
    });
});

app.get('/signup',
function(req, res) {
  res.render('signup');
});

app.post('/signup', 
function(req, res) {
  var username = req.body.username;
  var password = req.body.password;
  new User({'username': username})
    .fetch()
    .then(function(found) {
      if (found) {
        console.log('Username is already in use; please provide a different user name.');
        res.redirect('/signup');
      }
      else {
        Users.create({
          'username': username,
          'password': password
        })
        .then(function(newUser) {
          console.log('New account for user "' + username + '" has been created.');
          res.redirect('/login');
        });
      }
    });
});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        link.set('visits', link.get('visits')+1);
        link.save().then(function() {
          return res.redirect(link.get('url'));
        });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
