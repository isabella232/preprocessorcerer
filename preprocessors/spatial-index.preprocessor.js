var path = require('path');
var fs = require('fs');
var spawn = require('child_process').spawn;
var mapnik = require('mapnik');
var mapnik_index = mapnik.settings.paths.mapnik_index;
var invalid = require('../lib/invalid');
if (!fs.existsSync(mapnik_index)) {
  throw new Error('mapnik-index does not exist at ' + mapnik_index);
}

var mkdirp = require('mkdirp');

module.exports = function(infile, outdir, callback) {
  // outfile will be used for both the copied original and the index file
  var outfile = path.join(outdir, path.basename(infile));

  // Create copy of original file into new dir
  function copy(finished) {
    fs.createReadStream(infile)
      .once('error', callback)
      .pipe(fs.createWriteStream(outfile))
      .once('error', callback)
      .on('finish', finished);
  }

  mkdirp(outdir, function(err) {
    if (err) return callback(err);

    copy(function() {
      // Finally, create an .index file in the output dir
      // mapnik-index will automatically add ".index" to the end of the original filename
      var data = '';
      var p = spawn(mapnik_index, [outfile, '--validate-features'])
        .once('error', callback)
        .on('exit', function() {
          // If error printed to --validate-features log
          if (data.indexOf('Error') != -1) {
            callback(invalid('Invalid CSV or GeoJSON.'));
          }
          else callback();
        });

      p.stderr.on('data', function(d) {
        d.toString();
        data += d;
      });
    });
  });
};

module.exports.description = 'Add a spatial index to GeoJSON or CSV';

// TODO - expose this as ENV option?
module.exports.index_worthy_size = 10 * 1024 * 1024; // 10 MB

module.exports.criteria = function(infile, info, callback) {
  if (info.filetype !== 'geojson' && info.filetype !== 'csv') {
    return callback(null, false);
  }

  if (info.size === undefined) {
    return callback(new Error('info.size must be a valid number'));
  }

  // check size is warrants creating an index
  // TODO - expose this as ENV option?
  if (info.size >= module.exports.index_worthy_size) {
    return callback(null, true);
  } else {
    return callback(null, false);
  }
};
