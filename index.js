var path = require('path'),
  fs = require('fs'),
  f = require('util').format,
  semver = require('semver');

var exists = fs.existsSync || path.existsSync;

var find_package_json = function(location) {
  var found = false;

  while(!found) {
    if (exists(location + '/package.json')) {
      found = location;
    } else if (location !== '/') {
      location = path.dirname(location);
    } else {
      return false;
    }
  }

  return location;
}

var require_optional = function(name, options) {
  options = options || {};
  options.strict = typeof options.strict == 'boolean' ? options.strict : true;

  // Locate this module's package.json file
  var location = find_package_json(__dirname);
  if(!location) {
    throw new Error('package.json can not be located');
  }

  // Read the package.json file
  var object = JSON.parse(fs.readFileSync(f('%s/package.json', location)));
  // Is the name defined by interal file references
  var parts = name.split(/\//);

  // Optional dependencies exist
  if(!object.peerOptionalDependencies) {
    throw new Error(f('no optional dependency [%s] defined in peerOptionalDependencies in package.json', parts[0]));
  } else if(object.peerOptionalDependencies && !object.peerOptionalDependencies[parts[0]]) {
    throw new Error(f('no optional dependency [%s] defined in peerOptionalDependencies in package.json', parts[0]));
  }

  var expectedVersions = object.peerOptionalDependencies[parts[0]];

  try {
    // Validate if it's possible to read the module
    var moduleEntry = require(name);

    // Resolve the location of the module's package.json file
    var location = find_package_json(require.resolve(name));
    if(!location) {
      throw new Error('package.json can not be located');
    }

    // Read the module file
    var dependentOnModule = JSON.parse(fs.readFileSync(f('%s/package.json', location)));
    // Get the version
    var version = dependentOnModule.version;
    // Validate if the found module satisfies the version id
    if(semver.satisfies(version, expectedVersions) == false
      && options.strict) {
        var error = new Error(f('optional dependency [%s] found but version [%s] did not satisfy constraint [%s]', parts[0], version, expectedVersions));
        error.code = 'OPTIONAL_MODULE_NOT_FOUND';
        throw error;
    }

    // Satifies the module requirement
    return moduleEntry;
  } catch(err) {
    if(err.code != 'MODULE_NOT_FOUND') {
      throw err;
    }
  }
}

require_optional.exists = function(name) {
  try {
    var m = require_optional(name);
    if(m === undefined) return false;
    return true;
  } catch(err) {
    return false;
  }
}

module.exports = require_optional;
