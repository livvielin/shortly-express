var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var session = require('express-session');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var request = require('request');


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

//Github app credentials
var appSecret = '{APP_SECRET}';
var appID = '{APP_ID}';

// Parse JSON (uniform resource locators)
app.use(bodyParser.json());


//Cookie parser
app.use(cookieParser('test secret'));

// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));

//Session checking
app.use(session());

var isPublicUrl = function(req) {
  if (req.url.slice(0,6) === '/login' || req.url === '/signup')
    return true;
  else if(req.session.user)
    return true;
  else
    return false;
};

app.use(function(req, res, next) {
  Links.fetch().then(function(links) {
    if (isPublicUrl(req) || links.hasShortUrl(req.url)) {
      next();
    }
    else {
      req.session.error = "Access denied; redirecting to login page.";
      res.redirect('/login');
    }
  });
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

app.get('/login/auth',
function(req, res) {
  
var code = req.url.slice(17);

var options = {
    port: 443,
    path: '/',
    method: 'POST'
};

var data = {
  'client_id': appID,
  'code': code,
  'client_secret': appSecret};

request(
  { method: "POST",
    uri: 'https://github.com/login/oauth/access_token',
    port: 443,
    path: '/',
    json: {
      client_id: appID,
      code: code,
      client_secret: appSecret}
  }, 
  
  function (error, response, body) {
    if(!body.error) {
      console.log(code);
      console.log(body);
      req.session.regenerate( function() { 
        req.session.user = 'gitHubAuthorized';
        res.redirect('/');
      });
    }
  });
});

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
            res.redirect('/');
          });
        }
        else {
          console.log('Login credentials do not match; please input login credentials again.');
          res.redirect('/login');
        }
      }
      else {
        console.log('Login not recognized; please re-enter login credentials.');
        res.redirect('/login');
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
          res.redirect('/');
        });
      }
    });
});

app.get('/logout',
function(req, res) {
  if(req.username === 'gitHubAuthorized')
    {

    }
  req.session.destroy();
  res.redirect('/');
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
