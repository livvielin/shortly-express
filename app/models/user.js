var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',
  
  //Future return functions would be added here

  initialize: function() {
    this.on('creating', function(model, attrs, options){
      var salt = bcrypt.genSaltSync(10);
      var hash = bcrypt.hashSync(model.get('password'), salt);
      model.set('salt', salt);
      model.set('password', hash);
    });
  },

  checkPassword: function(inputPassword) {
    var salt = this.get('salt');
    var hashInput = bcrypt.hashSync(inputPassword, salt);
    if (hashInput === this.get('password'))
      return true;
    else
      return false;
  }
});





module.exports = User;