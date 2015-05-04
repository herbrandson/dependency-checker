var fs = require('fs');
var path = require('path');
var semver = require('semver');
var promise = require('bluebird');
var eol = require('os').EOL;


function _process(result, type) {
	var isValid = (result.bad.length === 0);

	if (!isValid) {
		console.log('Missing ' + type + ' dependencies:');
		result.bad.forEach(function(item) {
			var message = item.name + eol + '  expected: ' + item.requested + eol + '  actual:   ' + (item.actual || 'missing') + eol;
			console.log(message);
		});
	}

	return isValid;
}

var self = {
	hasNeededDependencies: function(includeDevDependencies) {
		var isValid = true;

		return self.checkNpm(includeDevDependencies)
			.then(function(result) {
				isValid &= _process(result, 'npm');

				return self.checkBower(includeDevDependencies);
			})
			.then(function(result) {
				isValid &= _process(result, 'bower');

				return !!isValid;
			});
	},

	checkNpm: function(includeDevDependencies) {
		return self.check('package.json', './node_modules', includeDevDependencies);
	},

	checkBower: function(includeDevDependencies) {
		return self.check('bower.json', './bower_components', includeDevDependencies);
	},

	check: function(package, root, includeDevDependencies) {
		var installed;

		return promise.try(function() {
				return self.getInstalledPackages(root, package);
			})
			.then(function(data) {
				installed = data;
				return self.getRequiredPackages(package, includeDevDependencies);
			})
			.then(function(requested) {
				return self.getStatus(requested, installed);
			});
	},

	getInstalledPackages: function(root, package) {
		// TODO: make this all async

		if (!fs.existsSync(root)) {
			return {notFound:root};
		}

		return promise.promisify(fs.readdir)(root)
			.then(function(data) {
				var installed = {};
				data.forEach(function(directory) {
					var packagePath = path.join(root, directory, package);

					if (!fs.existsSync(packagePath)) { return; }

					var packageData = fs.readFileSync(packagePath);
					var packageJson = JSON.parse(packageData);
					installed[packageJson.name] = packageJson.version;
				});

				return installed;
			});
	},

	getRequiredPackages: function(package, includeDevDependencies) {
		if (!fs.existsSync(package)) {
			return {};
		}

		return promise.promisify(fs.readFile)(package, 'utf8')
			.then(function(data) {
				var result = {};
				var json = JSON.parse(data);

				if (includeDevDependencies) {
					for (var devKey in json.devDependencies) {
						result[devKey] = json.devDependencies[devKey];
					}
				}

				for (var key in json.dependencies) {
					result[key] = json.dependencies[key];
				}

				return result;
			});
	},

	getStatus: function(requested, installed) {
		var result = {good:[], bad:[]};

		Object.keys(requested).forEach(function(name) {
			var dependency = {
				name: name,
				requested: requested[name],
				actual: installed[name],
			};

			var isValid = semver.satisfies(dependency.actual, dependency.requested);
			var target = isValid ? result.good : result.bad;
			target.push(dependency);
		});

		return result;
	},
};

module.exports = self;
