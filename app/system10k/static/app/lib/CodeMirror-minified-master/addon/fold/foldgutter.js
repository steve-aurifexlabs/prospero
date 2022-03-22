'use strict';var $jscomp=$jscomp||{};$jscomp.scope={};$jscomp.findInternal=function(a,f,d){a instanceof String&&(a=String(a));for(var h=a.length,g=0;g<h;g++){var k=a[g];if(f.call(d,k,g,a))return{i:g,v:k}}return{i:-1,v:void 0}};$jscomp.ASSUME_ES5=!1;$jscomp.ASSUME_NO_NATIVE_MAP=!1;$jscomp.ASSUME_NO_NATIVE_SET=!1;$jscomp.SIMPLE_FROUND_POLYFILL=!1;
$jscomp.defineProperty=$jscomp.ASSUME_ES5||"function"==typeof Object.defineProperties?Object.defineProperty:function(a,f,d){a!=Array.prototype&&a!=Object.prototype&&(a[f]=d.value)};$jscomp.getGlobal=function(a){a=["object"==typeof window&&window,"object"==typeof self&&self,"object"==typeof global&&global,a];for(var f=0;f<a.length;++f){var d=a[f];if(d&&d.Math==Math)return d}return globalThis};$jscomp.global=$jscomp.getGlobal(this);
$jscomp.polyfill=function(a,f,d,h){if(f){d=$jscomp.global;a=a.split(".");for(h=0;h<a.length-1;h++){var g=a[h];g in d||(d[g]={});d=d[g]}a=a[a.length-1];h=d[a];f=f(h);f!=h&&null!=f&&$jscomp.defineProperty(d,a,{configurable:!0,writable:!0,value:f})}};$jscomp.polyfill("Array.prototype.find",function(a){return a?a:function(a,d){return $jscomp.findInternal(this,a,d).v}},"es6","es3");
(function(a){"object"==typeof exports&&"object"==typeof module?a(require("../../lib/codemirror"),require("./foldcode")):"function"==typeof define&&define.amd?define(["../../lib/codemirror","./foldcode"],a):a(CodeMirror)})(function(a){function f(b){this.options=b;this.from=this.to=0}function d(b,c){b=b.findMarks(p(c,0),p(c+1,0));for(var a=0;a<b.length;++a)if(b[a].__isFold){var e=b[a].find(-1);if(e&&e.line===c)return b[a]}}function h(b){if("string"==typeof b){var c=document.createElement("div");c.className=
b+" CodeMirror-guttermarker-subtle";return c}return b.cloneNode(!0)}function g(b,c,a){var e=b.state.foldGutter.options,q=c-1,f=b.foldOption(e,"minFoldSize"),g=b.foldOption(e,"rangeFinder"),k="string"==typeof e.indicatorFolded&&new RegExp("(^|\\s)"+e.indicatorFolded+"(?:$|\\s)\\s*"),n="string"==typeof e.indicatorOpen&&new RegExp("(^|\\s)"+e.indicatorOpen+"(?:$|\\s)\\s*");b.eachLine(c,a,function(c){++q;var a=null,m=c.gutterMarkers;m&&(m=m[e.gutter]);if(d(b,q)){if(k&&m&&k.test(m.className))return;a=
h(e.indicatorFolded)}else{var l=p(q,0);if((l=g&&g(b,l))&&l.to.line-l.from.line>=f){if(n&&m&&n.test(m.className))return;a=h(e.indicatorOpen)}}(a||m)&&b.setGutterMarker(c,e.gutter,a)})}function k(b){var c=b.getViewport(),a=b.state.foldGutter;a&&(b.operation(function(){g(b,c.from,c.to)}),a.from=c.from,a.to=c.to)}function r(b,c,a){var e=b.state.foldGutter;e&&(e=e.options,a==e.gutter&&((a=d(b,c))?a.clear():b.foldCode(p(c,0),e)))}function n(b){var c=b.state.foldGutter;if(c){var a=c.options;c.from=c.to=
0;clearTimeout(c.changeUpdate);c.changeUpdate=setTimeout(function(){k(b)},a.foldOnChangeTimeSpan||600)}}function t(a){var c=a.state.foldGutter;if(c){var b=c.options;clearTimeout(c.changeUpdate);c.changeUpdate=setTimeout(function(){var b=a.getViewport();c.from==c.to||20<b.from-c.to||20<c.from-b.to?k(a):a.operation(function(){b.from<c.from&&(g(a,b.from,c.from),c.from=b.from);b.to>c.to&&(g(a,c.to,b.to),c.to=b.to)})},b.updateViewportTimeSpan||400)}}function l(a,c){var b=a.state.foldGutter;b&&(c=c.line,
c>=b.from&&c<b.to&&g(a,c,c+1))}a.defineOption("foldGutter",!1,function(b,c,d){d&&d!=a.Init&&(b.clearGutter(b.state.foldGutter.options.gutter),b.state.foldGutter=null,b.off("gutterClick",r),b.off("changes",n),b.off("viewportChange",t),b.off("fold",l),b.off("unfold",l),b.off("swapDoc",n));c&&(d=b.state,!0===c&&(c={}),null==c.gutter&&(c.gutter="CodeMirror-foldgutter"),null==c.indicatorOpen&&(c.indicatorOpen="CodeMirror-foldgutter-open"),null==c.indicatorFolded&&(c.indicatorFolded="CodeMirror-foldgutter-folded"),
d.foldGutter=new f(c),k(b),b.on("gutterClick",r),b.on("changes",n),b.on("viewportChange",t),b.on("fold",l),b.on("unfold",l),b.on("swapDoc",n))});var p=a.Pos});