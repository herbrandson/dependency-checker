var fs = require('fs');
var path = require('path');
var semver = require('semver');
var promise = require('bluebird');

var self = {
	checkNpm: function() {
		return self.check('package.json', './node_modules');
	},

	checkBower: function() {
		return self.check('bower.json', './bower_components');
	},

	check: function(package, root) {
		var installed;

		return promise.try(function() {
				return self.getInstalledPackages(root);
			})
			.then(function(data) {
				installed = data;
				return self.getRequiredPackages(package);
			})
			.then(function(requested) {
				return self.getStatus(requested, installed);
			});
	},

	getInstalledPackages: function(root) {
		if (!fs.existsSync(root)) {
			return {};
		}

		return promise.promisify(fs.readdir)(root)
			.then(function(data) {
				// TODO: make this all async
				var installed = {};

				data.forEach(function(directory) {
					var packagePath = path.join(root, directory, 'package.json');

					if (!fs.existsSync(packagePath)) { return; }

					var packageData = fs.readFileSync(packagePath);
					var packageJson = JSON.parse(packageData);
					installed[packageJson.name] = packageJson.version;
				});

				return installed;
			});
	},

	getRequiredPackages: function(package) {
		if (!fs.existsSync(package)) {
			return {};
		}

		return promise.promisify(fs.readFile)(package, 'utf8')
			.then(function(data) {
				return JSON.parse(data).dependencies;
			});
	},

	getStatus: function(requested, installed) {
		var result = {good:[], bad:[]};

		Object.keys(requested).forEach(function(name) {
			var dependency = {
				name: name,
				requested: requested[name],
				actual: (installed[name]) ? installed[name] : '',
			};

			var isValid = semver.satisfies(dependency.actual, dependency.requested);
			var target = isValid ? result.good : result.bad;
			target.push(dependency);
		});

		return result;
	},
};

module.exports = self;
