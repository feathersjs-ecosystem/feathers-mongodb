var exec = require('child_process').exec;

module.exports = function(grunt) {

  // Project configuration.
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    meta: {
      banner: '/*! <%= pkg.title || pkg.name %> - v<%= pkg.version %> - ' +
        '<%= grunt.template.today("yyyy-mm-dd") %>\n' +
        '<%= pkg.homepage ? "* " + pkg.homepage + "\n" : "" %>' +
        '* Copyright (c) <%= grunt.template.today("yyyy") %> <%= pkg.author.name %>;' +
        ' Licensed <%= _.pluck(pkg.licenses, "type").join(", ") %> */'
    },

    /* Testing
    =======================================================*/
    simplemocha: {
      options: {
        globals: ['should', 'expect'],
        timeout: 3000,
        ui: 'bdd'
      },

      all: { src: 'test.js' }
    },

    /* Documentation
    =======================================================*/
    dox: {
      options: {
        title: "<%= pkg.title || pkg.name %>"
      },
      files: {
        src: ['mongodb.js'],
        dest: 'docs'
      }
    }
  });

  grunt.loadNpmTasks('grunt-simple-mocha');
  grunt.loadNpmTasks('grunt-release');
  grunt.loadNpmTasks('grunt-dox');

  // Alias'
  // --------------------------------------------------
  grunt.registerTask('test', ['simplemocha:all']);

  // Default Task.
  grunt.registerTask("default", ['development']);

  // Development Tasks
  // --------------------------------------------------
  grunt.registerTask('development', ['test']);

  // Release Tasks
  // --------------------------------------------------
};