var common = require('./common');

var sdk = common.getTestSDK();
var user = common.loginUser(sdk);

describe('project', function() {
    it('should support listing', function(done) {
        user.then(function(user) {
            return user.listProjects();
        }).then(function(projects) {
            done();
        });
    });
    it('should support opening a project', function(done) {
        // HACK: See comments for helper.getFirstProject.
        common.getFirstProject(user).then(function() { done(); });
    });
});