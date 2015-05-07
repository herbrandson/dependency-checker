var fs = require('fs');
var path = require('path');
var chalk = require('chalk');
var semver = require('semver');
var promise = require('bluebird');
var eol = require('os').EOL;


var self = {
	hasNeededDependencies: function(includeDevDependencies) {
		var isValid = true;

		return self.checkNpm(includeDevDependencies)
			.then(function(result) {
				isValid &= _processResults(result, 'npm');

				return self.checkBower(includeDevDependencies);
			})
			.then(function(result) {
				isValid &= _processResults(result, 'bower');

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
					installed[directory] = _getPackageVersion(root, directory, package);
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
			var requestedVersion = requested[name];
			var actualVersion = installed[name];

			var target = _isValid(requestedVersion, actualVersion) ? result.good : result.bad;
			target.push({
				name: name,
				requested: requested[name],
				actual: installed[name],
			});
		});

		return result;
	},
};


function _getPackageVersion(root, directory, package) {
	var packagePath = path.join(root, directory, '.' + package);
	var result = _getPackageVersionFromFile(packagePath);
	if (result !== false) return result;

	packagePath = path.join(root, directory, package);
	result = _getPackageVersionFromFile(packagePath);
	if (result !== false) return result;

	return '*';
}

function _getPackageVersionFromFile(packagePath) {
	if (!fs.existsSync(packagePath)) {
		return false;
	}

	var packageData = fs.readFileSync(packagePath);
	var packageJson = JSON.parse(packageData);
	return packageJson.version || false;
}

function _isValid(requestedVersion, actualVersion) {
	var split = requestedVersion.split('#');
	var hash = split[split.length - 1];

	if (_isRepo(requestedVersion) && !semver.clean(hash)) {
		return !!actualVersion;
	}

	if (actualVersion === '*') {
		return true;
	}

	return semver.satisfies(actualVersion, hash);
}

function _isRepo(str) {
	return str.indexOf('/') > -1 || (/^git(\+(ssh|https?))?:\/\//i).test(str) || (/\.git\/?$/i).test(str) || (/^git@/i).test(str);
}

function _processResults(result, type) {
	var isValid = (result.bad.length === 0);

	if (!isValid) {
		console.log(chalk.red('Missing ' + type + ' dependencies:'));
		result.bad.forEach(function(item) {
			var message = chalk.cyan(item.name) + eol +
						chalk.gray('requested: ') + item.requested + eol +
						chalk.gray('actual:    ') + (item.actual || 'missing') + eol;

			console.log(message);
		});
	}

	return isValid;
}

module.exports = self;
