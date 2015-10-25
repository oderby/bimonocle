module.exports = function(grunt) {
    grunt.initConfig({
        jshint: {
            all: ["Gruntfile.js", "lib/**/*.js", "test/**/*.js"],
        },
        mochaTest: {
            unit: {
                options: {
                    require: 'test/common.js'
                },
                src: ["test/unit/**/test*.js"]
            },
            integration: {
                options: {
                    require: 'test/integration/common.js',
                    timeout: 60000,
                },
                src: ["test/integration/**/test*.js"]
            },
        },
    });

    grunt.loadNpmTasks("grunt-contrib-jshint");
    grunt.loadNpmTasks("grunt-mocha-test");
    grunt.loadNpmTasks('grunt-contrib-uglify');

    grunt.registerTask("default", ["jshint", "mochaTest:unit"]);
};