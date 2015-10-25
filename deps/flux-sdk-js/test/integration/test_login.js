var common = require('./common');

var sdk = common.getTestSDK();

describe('login', function() {
    it('should work', function(done) {
        common.loginUser(sdk).then(function(user) {
            done();
        }).catch(function(err) {
            done(err);
        });
    });
});