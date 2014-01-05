var mkdirp    = require('mkdirp')
	, moment    = require('moment')
	, request   = require('request')
	, send      = require('send')
	, im        = require('imagemagick')
	, path      = require('path')
	, fs        = require('fs')
	, crypto    = require('crypto')

var options = {}
	, regexp = ''
	, rootDir
	, cacheDir
	, ttl
	, cacheTTL
	, quality;


// -- Constructor -------------------------------------------------------------

var media = function(opts) {

	_parseOptions(opts || {})

	return function (req, res, next) {

		function resume(runNext){
			if (runNext) next();
		}

		// Only GET + HEAD, if not NEXT()
		if (req.method != 'GET' && req.method != 'HEAD') return resume(true);

		// If the URL is not valid (regexp matching) NEXT()
		var request = req.originalUrl.match(regexp);
		if (!request) return resume(true);

		//----------------------------------------------------------

		var keyVal = new RegExp(':')
			, params = request[1].split(/,/)  // h:400,q:80
			, path = rootDir + request[2]     // /var/www/public/toto/truc/monimage.jpg
			, url = request[2]                // /toto/truc/monimag.jpg
			, parameters = {}                 // {h: 400, q: 80}

		if(!fs.existsSync(path)){
			res.writeHead(404)
			res.end('Not found: '+url)
			return resume(false)
		}

		if(params.length){
			params.forEach(function(e){
				var kv = e.split(keyVal)
				parameters[kv[0]] = kv[1]
			})
		}else{
			res.writeHead(500)
			res.end('No parameter found in url')
			return resume(false)
		}

		//----------------------------------------------------------

		var cachedFile = _destination(url, parameters)

		// see if we can serve the file from file cache, if ttl has not yet expired
		if (cacheTTL > 0) {
			try {
				var stats = fs.statSync(cachedFile)
					, fileUnix = moment(stats.mtime).unix()
					, nowUnix = moment().unix()
					, diffUnix = nowUnix - fileUnix;

				// file is fresh, no need to download/resize etc.
				if (diffUnix < cacheTTL) {
					res.setHeader('X-Hit-Cache', '1');
					send(req, cachedFile).maxage(ttl || 0).pipe(res);
					return resume(false);
				}
			} catch (err) {
				// no action necessary, just continue with normal flow
			}
		}

		parameters.src = path;
		parameters.dst = cachedFile;

		_generate(parameters, function(err) {
				if (err){
					if(typeof err == 'string'){
						res.writeHead(500)
						res.end(err);
						return resume(false)
					}else{
						throw err;
					}
				}

				res.setHeader('X-Hit-Cache', '0');
				send(req, cachedFile).maxage(ttl || 0).pipe(res);

				return resume(false);
			}
		);
	}

}


// -- Internal Jam ------------------------------------------------------------

var _parseOptions = function (options) {

	var day  = 3600 * 24;

	ttl      = ('ttl' in options) ? parseInt(options.ttl) : day;  // max-age for 1 day by default.
	cacheTTL = ('cacheTTL' in options) ? options.cacheTTL : day;  // use local cache for 1 day by default
	quality  = ('quality' in options) ? parseInt(options.quality) / 100 : 0.8;

//	console.log('ttl='+ttl, 'cacheTTL='+cacheTTL);

	rootDir  = options.root
	cacheDir = options.cache

	console.log(cacheDir, options);

	if(!'root' in options || options.root == '' || !fs.existsSync(options.root)){
		throw new Error('root parameter is not defined, empty or not founds');
	}

	if(!'cache' in options || options.cache == ''){
		throw new Error('cache parameter is not defined, empty or not found');
	}

	var allowedExtensions = options.allowedExtensions || ['gif', 'png', 'jpg'];
	for (i=0; i < allowedExtensions.length; i++) {
		if (allowedExtensions[i][0] === '.') allowedExtensions[i] = allowedExtensions[i].substring(1);
	}

	regexp = new RegExp(
		'^/' + '([a-z]:[^/]*)' + '(/(.*)' + '\.(?:' + allowedExtensions.join('|') + '))$',
		'i'
	);

}

var _generate = function (opt, callback) {

	var src = opt.src
		, dst = opt.dst

	// Trouver les dimensions de l'image source
	im.identify(['-format', '%wx%h', src], function(err, dimension){

		if (err) callback(err);

		var arrDimension = dimension.split("x")
			, origWidth = parseInt(arrDimension[0])
			, origHeight = parseInt(arrDimension[1])
			, gravity =  ['NorthWest', 'North', 'NorthEast', 'West', 'Center', 'East', 'SouthWest', 'South', 'SouthEast']
			, imOptions = {
				srcPath: src,
				dstPath: dst,
				quality: quality
			}

		// -- Quality
		if('q' in opt) imOptions.quality = parseInt(opt.q) / 100;

		// -- H+W=C
		if('h' in opt && 'w' in opt){
			opt.c = opt.w+'.'+ opt.h
			delete opt.w
			delete opt.h
		}

		// -- SQUARE
		if('s' in opt){

			var value = parseInt(opt.s)

			if(origHeight > origWidth && value > origWidth){
				value = origWidth
			}else
			if(origWidth > origHeight && value > origHeight){
				value = origHeight
			}

			imOptions.gravity = 'Center';
			imOptions.width = value;
			imOptions.height = value;

			im.crop(imOptions, function(err, stdout, stderr){
				callback(err);
			});

		}else

		// -- CROP
		if('c' in opt){

			if('g' in opt && gravity.indexOf(opt.g) > -1){
				imOptions.gravity = opt.g;
			}else{
				imOptions.gravity = 'Center';
			}

			var arrProp = opt.c.split('.')
			if(arrProp.length != 2) return callback('Crop mode accept only 2 values: w.h');

			imOptions.width = parseInt(arrProp[0]);
			if(isNaN(imOptions.width)) return callback('Width value is not valid');

			imOptions.height = parseInt(arrProp[1])
			if(isNaN(imOptions.height)) return callback('Height value is not valid');

			im.crop(imOptions, function(err, stdout, stderr){
				callback(err);
			});

		}else

		// -- HEIGHT
		if('h' in opt){
			imOptions.height = parseInt(opt.h);

			if(isNaN(imOptions.height)) return callback('Parameter "h" is not a number');
			if(imOptions.height > origHeight) imOptions.height = origHeight

		}else

		// -- WIDTH
		if('w' in opt){
			imOptions.width  = parseInt(opt.w);

			if(isNaN(imOptions.width)) return callback('Parameter "w" is not a number');
			if(imOptions.width > origWidth) imOptions.width = origWidth

		}
		
		else{
			return callback('Sorry, what did you say ? No comprendo amigo !')
		}

		// Do The Magic
		im.resize(imOptions, function(err, stdout, stderr){
			callback(err);
		});

	});

}

var _destination = function (url, parameters){

	var ext = path.extname(url)             // .jpg
		, name = path.basename(url, ext)      // monimage
		, dir = path.dirname(url)             // /toto/truc
		,  hash = ''                          // h600_w:300...
		, cachedDir , cachedFile

	cachedDir = cacheDir + dir

	mkdirp.sync(cachedDir)

	for(k in parameters){
		hash += '_'+k + parameters[k];
	}

	cachedFile = cachedDir + '/' + name + hash + ext;

	return cachedFile;
}

var _error = function(key, req, res){ // Find a better solution to use req + res
	res.writeHead(500)
	res.end('param "'+ key +'" is not valid');
}


// -- Exports -----------------------------------------------------------------

exports = module.exports = media
