var chai = require('chai');
var dirtyChai = require('dirty-chai');
chai.use(dirtyChai);
var expect = chai.expect;

var util = require('../../lib/util');

describe('util', function() {
    describe('isNode', function() {
        it('should be true', function() {
            expect(util.isNode()).to.be.true();
        });
    });
    describe('header encoding/decoding', function() {
        it('should roundtrip', function() {
            // Intentionally include non-ASCII utf-8 string data.
            var x = {a: [1, 2, 3], b:"日本語"};
            expect(util.decodeHeader(util.encodeHeader(x))).to.deep.equal(x);
        });
    });
});