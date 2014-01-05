# Express Middleware Image
---

This module is an expressejs middleware to create picture thumbnails.

This allow to use  `http://host/h:800/monfile.jpg` instead of `http://host/mafile.jpg?heihgt=800`

This makes clear and easy to read URLS.


## Install
`npm install` installs imagemagick **wrapper**, so you need to install imagemagick binaries too.

###### OSX
Brew make things really simple  

	# brew update
	# brew install imagemagick
	... wait your beer

###### Linux
You can [build from source](http://www.imagemagick.org/script/binary-releases.php) or ask [google](https://www.google.fr/search?q=imagemagick+debian+ubuntu).


## Usage
This is a very basic bootstrap
	
	var express = require('express')
		, emi = require('express-middleware-image')
		, app = express()

	app.configure(function(){
		app.set('port', process.env.PORT || 3000);
		app.use(express.logger('dev'));
		app.use(emi({
			// check options bellow
		}));
	});
	
	http.createServer(app).listen(app.get('port'), function () {
		console.log("Express server listening on port " + app.get('port'));
	});

#### Options

###### — root (required)
the folder containing source pictures (absolute path)  

###### — cache (required)
this folder stores cache data,  if this folder does not exists, it will be created with the first generation

###### — ttl (default 1 day)
max-age header sent to brower in seconds.

###### — cacheTTL (default 1 day)
time to serve cached version in seconds. To totally disable cache, use 0.

###### — allowedExtensions (default ['gif', 'png', 'jpg'])
array of extension allowed. Used in the regexp to check if the request could be handled.

###### — quality (default 80)
jpeg files compression factor, from 1 (light but ugly) to 100 (max but heavy) This parameter is overwriten if `q:` url parameter is used. This could be used to define a global default quality value for all request.


### Scheme

Image generation are request url based. All you need is to call this URL: 

	http://localhost:3000/key:val[,key2:val2]/path/to/file.jpg

You can add more keys. Ex: 300px height and a very poor quality: 

	http://localhost:3000/h:300,q:10/path/to/file.jpg

#### Keys

###### — h (=height)
Define the Height of the picture, respect the ratio

###### — w (=width)
Same behaviour as `h` but set the width

###### — s (=square)
Create a square picture. This method uses the `cut`and `gravity` parameters from imagemagick

###### — c (=crop)
Crop the picture with `w` and `h` parameters. (c:800.100) for a 800px width and 100px height. By default the crop is centered.  
You can specify a region with `g:value` option. Allowed values are: [NorthWest, North, NorthEast, West, Center, East, SouthWest, South, SouthEast] (case sensitive)

###### — q (=qality)
Specify a quality between 0 to 100. Default options is used (80)

**NOTE**

- `h:100,w:100` is equivalent to `s:100`. The square mode is shorter.

- `h:100,w:800` is equivalent to `c:800.100`. The crop mode is shorter.

- If you set a value bigger than the source picture is, the source value is kept. For example, if you have 800px width picture and you ask for a 999px picture width, the generated will be 800px width.  

### Errors

If scheme is not respected, a 500 error is produced, with a gently error message dispayed in the browser.  


### Examples

http://localhost:3000/`w:400`/file.jpg => force Width  

http://localhost:3000/`h:500`/file.jpg => force Height  

http://localhost:3000/`s:600`/file.jpg => square image  

http://localhost:3000/`c:600.100`/file.jpg => panoramic picture

http://localhost:3000/`c:600.100:g:South,q:10`/file.jpg => panoramic picture cropped to South region and a vey low quality


### Tips

If you want to know if the image delivered is cached or not, have a look to `X-Hit-Cache` header, (1 = cached, 0 = not cached)



  
    
    
    
     

