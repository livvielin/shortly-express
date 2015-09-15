var db = require('../config');
var Link = require('../models/link');
var _ = require('underscore');

var Links = new db.Collection();

Links.model = Link;

Links.hasShortUrl = function(route) {
  // /a9736
  var shortUrlCode = route.slice(1);
  return _.reduce(this.models, function(memo, link) {
    return memo || (link.get('code') === shortUrlCode);
  }, false, this);
};

module.exports = Links;
