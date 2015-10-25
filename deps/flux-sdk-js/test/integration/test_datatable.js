"use strict";

var common = require('./common');
var expect = require('chai').expect;

var when = require('when');

var sdk = common.getTestSDK();
var user = common.loginUser(sdk);
// HACK: See comments for helper.getFirstProject.
var project = common.getFirstProject(user);

var clientMetaData = {
    Label: "Test",
    Description: "Test Key",
};

var testValue = {a: [1, 2, 3], b:"日本語"};

describe('datatable', function() {
    describe('Base API', function() {
        // NOTE: This is meant to only test the Base DataTablePI.
        // However, because the current implementation is backed by
        // the PVS we have certain constraints. In particular, we
        // must specify the Client Metadata fields for requests which
        // have that option.
        it('can be fetched from a project', function(done) {
            project.then(function(p) {
                var dt = p.datatable;
                done();
            });
        });
        it('should have capabilities', function(done) {
            var dt = project.then(function(p) {
                return p.datatable;
            });
            dt.then(function(dt) {
                return dt.capability();
            }).then(function(capability) {
                done();
            }).catch(function(err) {
                done(err);
            });
        });
        it('should list cells', function(done) {
            var dt = project.then(function(p) {
                return p.datatable;
            });
            dt.then(function(dt) {
                return dt.cells();
            }).then(function(cells) {
                done();
            }).catch(function(err) {
                done(err);
            });
        });
        it('should create and delete cells', function(done) {
            var dtp = project.then(function(p) {
                return p.datatable;
            });
            var n;
            var dt;
            var cellInfo;
            dtp.then(function(dtobj) {
                dt = dtobj;
                // First get the cells so we can compute the current number.
                return dt.cells();
            }).then(function(cells) {
                // This is the original number of cells
                n = cells.cellIds.length;
                // Now we create a cell.
                return dt.create(null, {
                    ClientMetaData: clientMetaData,
                });
            }).then(function(ci) {
                cellInfo = ci.cellInfo;
                // If we re-fetch the cells, then
                return dt.cells();
            }).then(function(cells) {
                // ... we expect the number to have increased by one.
                expect(cells.cellIds.length).to.equal(n + 1);
                // If we now delete the just-created cell, then
                return dt.delete(cellInfo.CellId);
            }).then(function() {
                return dt.cells();
            }).then(function(cells) {
                // ... we expect the number to be back to the original.
                expect(cells.cellIds.length).to.equal(n);
                done();
            }).catch(function(err) {
                // Theoretically we could just pass done into the catch
                // directly, but done seems to JSON.stringify the err
                // and there are cases where that can include cycles
                // which means that the done invocation itself explodes.
                // To override this and inspect sub-parts of err I'm
                // leaving this more readily exposed.
                done(err);
            });
        });
        it('should allow setting and getting values', function(done) {
            var dtp = project.then(function(p) {
                return p.datatable;
            });
            var dt;
            var cellInfo;
            var testValue = {a: [1, 2, 3], b:"日本語"};
            dtp.then(function(dtobj) {
                dt = dtobj;
                // Create a key for this test.
                return dt.create(null, {
                    ClientMetaData: clientMetaData,
                });
            }).then(function(ci) {
                cellInfo = ci.cellInfo;
                // If we set a cell to a value.
                return dt.set(cellInfo.CellId, testValue);
            }).then(function() {
                // ... and then get the value in the cell.
                return dt.get(cellInfo.CellId);
            }).then(function(value) {
                expect(value.value).to.deep.equal(testValue);
                done();
            }).catch(function(err) {
                done(err);
            });
        });
    });
    describe('Metadata', function() {
        // TODO(daishi): Fill me in.
    });
    describe('Client Metadata', function() {
        // We have already tested client meta-data support above
        // since we're using the PVS-backed service.
    });
    describe('Notification', function() {
        // Wait for this amount of time for expected messages to arrive.
        var timeoutMsecs = 1000;

        it('should work', function(done) {
            // We need a second user to test notification.
            var user2 = common.loginUser(sdk);
            var projectInfo;

            var dt;
            var dt2;
            var cellInfo;
            // Notification buffer.
            var n1 = [];
            var n2 = [];
            function clearNotificationBuffers() {
                n1 = [];
                n2 = [];
            }

            project.then(function(p) {
                // Save the project id so we can fetch the same
                // project as user2.
                projectInfo = p.projectInfo;
                return p.datatable;
            }).then(function(dtref) {
                dt = dtref;
                // Subscribe the first user to notifications.
                dt.subscribe(
                    { Types: [dt.NotificationType.ALL] },
                    function(notification) {
                        n1.push(notification);
                    });
                // Get the same project as user2.
                return user2;
            }).then(function(u2) {
                return u2.getProject(projectInfo);
            }).then(function(p2) {
                return p2.datatable;
            }).then(function(dtref2) {
                dt2 = dtref2;
                // Subscribe the second user to notifications.
                dt2.subscribe(
                    { Types: [dt2.NotificationType.ALL] },
                    function(notification) {
                        n2.push(notification);
                    });
                // Delay for timeout to allow for subscriptions
                // messages to settle.
                return when().delay(timeoutMsecs);
            }).then(function() {
                // Create a new cell, waiting timeoutMsecs for
                // the operation to complete.
                return dt.create(null, {
                    ClientMetaData: clientMetaData,
                }).delay(timeoutMsecs);
            }).then(function() {
                // User2 should have been notified of the creation.
                expect(n2.length).to.equal(1);
                var msg = n2[0];
                expect(msg.Type).to.equal(dt.NotificationType.CellCreated);
                cellInfo = msg.CellInfo;
                clearNotificationBuffers();
            }).then(function() {
                // Have User2 set a value, and wait for timeoutMsecs.
                return dt2.set(cellInfo.CellId, testValue).delay(timeoutMsecs);
            }).then(function(ci) {
                // User1 should have been notified of the value set.
                expect(n1.length).to.equal(1);
                var msg = n1[0];
                expect(msg.Type).to.equal(dt.NotificationType.CellUpdated);
                // Double-check that the updated cell is the one we expect.
                expect(msg.CellInfo.CellId).to.equal(cellInfo.CellId);
                clearNotificationBuffers();
            }).then(function() {
                // Delete the test cell and wait for timeoutMsecs.
                return dt.delete(cellInfo.CellId).delay(timeoutMsecs);
            }).then(function(ci) {
                // User2 should have been notified about the deletion.
                expect(n2.length).to.equal(1);
                var msg = n2[0];
                expect(msg.Type).to.equal(dt.NotificationType.CellDeleted);
                // Double-check that the deleted cell is the one we expect.
                expect(msg.CellInfo.CellId).to.equal(cellInfo.CellId);
                clearNotificationBuffers();
                done();
            }).catch(function(err) {
                done(err);
            });
        });
    });
    describe('Reference', function() {
        // TODO(daishi): Add support for references and test.
    });
});