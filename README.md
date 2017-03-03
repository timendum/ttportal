Tiny Tiny RSS Portal
========

Tiny Tiny RSS Portal is a Javascript portal, composed by feed widgets, similar to iGoogle or Netvibes.

Any help is appreciated, expecially on styling/CSS.

Installation
-------------
Download all the files in a directory on the same webserver of Tiny Tiny RSS.

On the Tiny Tiny RSS enable the API access.

Create a "Portal" category and add new feeds.

The go to index.html.

End

### Note ###
You can install the Tiny Tiny RSS Portal anywhere, even in your hard disk, but you have to enable the `Access-Control-Allow-Origin` header in ttrss the webserver.


Details
-------------
There is only one HTML file, named `index.html`, which contains also templates.

There are two css files, one `portal.css` with basic styling and `basic.css` with coloring and images.

The main javascript stuff is in the `portal.js`, plus a `rss.js` where the API access.


### Dependencies ###
* jQuery 3
* jQuery UI 1.12
* Mustache 2
