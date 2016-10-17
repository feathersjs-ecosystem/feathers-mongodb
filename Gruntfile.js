module.exports = function (grunt) {
  grunt.initConfig({
    pkg: grunt.file.readJSON('package.json'),
    release: {},
    simplemocha: {
      all: {
        src: ['test/**/*.js']
      }
    },
    watch: {
      scripts: {
        files: '**/*.js',
        tasks: ['simplemocha'],
        options: {
        }
      }
    }
  });

  grunt.loadNpmTasks('grunt-release');
  grunt.loadNpmTasks('grunt-simple-mocha');
  grunt.loadNpmTasks('grunt-contrib-watch');

  grunt.registerTask('test', ['simplemocha']);
  grunt.registerTask('default', ['simplemocha', 'watch']);
};
