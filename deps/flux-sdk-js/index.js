(function (define) {
'use strict';
define(function(require) {
    // The default behavior is to use when's Promise shim.
    // For our clients which have builtin Promise implementations the
    // index_client.js entrypoint should be used.
    // The eventual goal is to eliminate the need to have these two
    // separate files.
    require('when/es6-shim/Promise');
    return require('./lib/sdk');
});
}(typeof define === 'function' && define.amd ? define : function (factory) { module.exports = factory(require); }));
