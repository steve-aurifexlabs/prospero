'use strict';var $jscomp=$jscomp||{};$jscomp.scope={};$jscomp.checkStringArgs=function(a,c,b){if(null==a)throw new TypeError("The 'this' value for String.prototype."+b+" must not be null or undefined");if(c instanceof RegExp)throw new TypeError("First argument to String.prototype."+b+" must not be a regular expression");return a+""};$jscomp.ASSUME_ES5=!1;$jscomp.ASSUME_NO_NATIVE_MAP=!1;$jscomp.ASSUME_NO_NATIVE_SET=!1;$jscomp.SIMPLE_FROUND_POLYFILL=!1;
$jscomp.defineProperty=$jscomp.ASSUME_ES5||"function"==typeof Object.defineProperties?Object.defineProperty:function(a,c,b){a!=Array.prototype&&a!=Object.prototype&&(a[c]=b.value)};$jscomp.getGlobal=function(a){a=["object"==typeof window&&window,"object"==typeof self&&self,"object"==typeof global&&global,a];for(var c=0;c<a.length;++c){var b=a[c];if(b&&b.Math==Math)return b}return globalThis};$jscomp.global=$jscomp.getGlobal(this);
$jscomp.polyfill=function(a,c,b,f){if(c){b=$jscomp.global;a=a.split(".");for(f=0;f<a.length-1;f++){var n=a[f];n in b||(b[n]={});b=b[n]}a=a[a.length-1];f=b[a];c=c(f);c!=f&&null!=c&&$jscomp.defineProperty(b,a,{configurable:!0,writable:!0,value:c})}};
$jscomp.polyfill("String.prototype.repeat",function(a){return a?a:function(a){var b=$jscomp.checkStringArgs(this,null,"repeat");if(0>a||1342177279<a)throw new RangeError("Invalid count value");a|=0;for(var c="";a;)if(a&1&&(c+=b),a>>>=1)b+=b;return c}},"es6","es3");
(function(a){"object"==typeof exports&&"object"==typeof module?a(require("../../lib/codemirror")):"function"==typeof define&&define.amd?define(["../../lib/codemirror"],a):a(CodeMirror)})(function(a){function c(l){if(l.getOption("disableInput"))return a.Pass;for(var c=l.listSelections(),g,n=[],p=0;p<c.length;p++){var h=c[p].head;if(!/\bcomment\b/.test(l.getTokenTypeAt(h)))return a.Pass;var m=l.getModeAt(h);if(!g)g=m;else if(g!=m)return a.Pass;var d=null,e,q=g.blockCommentStart;m=g.lineComment;if(q&&
g.blockCommentContinue){var k=l.getLine(h.line);var r=k.lastIndexOf(g.blockCommentEnd,h.ch-g.blockCommentEnd.length);if(!(-1!=r&&r==h.ch-g.blockCommentEnd.length||m&&-1<(e=k.lastIndexOf(m,h.ch-1))&&/\bcomment\b/.test(l.getTokenTypeAt({line:h.line,ch:e+1}))))if(h.ch>=q.length&&-1<(e=k.lastIndexOf(q,h.ch-q.length))&&e>r)if(b(0,k)>=e)d=k.slice(0,e);else{d=l.options.tabSize;var u;e=a.countColumn(k,e,d);d=l.options.indentWithTabs?t.call("\t",u=Math.floor(e/d))+t.call(" ",e-d*u):t.call(" ",e)}else-1<(e=
k.indexOf(g.blockCommentContinue))&&e<=h.ch&&e<=b(0,k)&&(d=k.slice(0,e));null!=d&&(d+=g.blockCommentContinue)}null==d&&m&&f(l)&&((null==k&&(k=l.getLine(h.line)),e=k.indexOf(m),h.ch||e)?-1<e&&b(0,k)>=e&&(d=-1<b(h.ch,k),d||(h=l.getLine(h.line+1)||"",d=h.indexOf(m),d=-1<d&&b(0,h)>=d||null),d&&(d=k.slice(0,e)+m+k.slice(e+m.length).match(/^\s*/)[0])):d="");if(null==d)return a.Pass;n[p]="\n"+d}l.operation(function(){for(var a=c.length-1;0<=a;a--)l.replaceRange(n[a],c[a].from(),c[a].to(),"+insert")})}function b(a,
b){n.lastIndex=a;return(a=n.exec(b))?a.index:-1}function f(a){return(a=a.getOption("continueComments"))&&"object"==typeof a?!1!==a.continueLineComment:!0}var n=/\S/g,t=String.prototype.repeat||function(a){return Array(a+1).join(this)};a.defineOption("continueComments",null,function(b,f,g){g&&g!=a.Init&&b.removeKeyMap("continueComment");f&&(g="Enter","string"==typeof f?g=f:"object"==typeof f&&f.key&&(g=f.key),f={name:"continueComment"},f[g]=c,b.addKeyMap(f))})});
