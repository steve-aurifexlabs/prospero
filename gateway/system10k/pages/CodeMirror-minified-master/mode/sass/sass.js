'use strict';(function(g){"object"==typeof exports&&"object"==typeof module?g(require("../../lib/codemirror"),require("../css/css")):"function"==typeof define&&define.amd?define(["../../lib/codemirror","../css/css"],g):g(CodeMirror)})(function(g){g.defineMode("sass",function(p){function h(a){return!a.peek()||a.match(/\s+$/,!1)}function q(a,b){var c=a.peek();if(")"===c)return a.next(),b.tokenizer=k,"operator";if("("===c)return a.next(),a.eatSpace(),"operator";b.tokenizer="'"===c||'"'===c?m(a.next()):
m(")",!1);return"string"}function r(a,b){return function(c,d){if(c.sol()&&c.indentation()<=a)return d.tokenizer=k,k(c,d);b&&c.skipTo("*/")?(c.next(),c.next(),d.tokenizer=k):c.skipToEnd();return"comment"}}function m(a,b){function c(d,e){var f=d.next(),g=d.peek(),l=d.string.charAt(d.pos-2);return"\\"!==f&&g===a||f===a&&"\\"!==l?(f!==a&&b&&d.next(),h(d)&&(e.cursorHalf=0),e.tokenizer=k,"string"):"#"===f&&"{"===g?(e.tokenizer=t(c),d.next(),"operator"):"string"}null==b&&(b=!0);return c}function t(a){return function(b,
c){return"}"===b.peek()?(b.next(),c.tokenizer=a,"operator"):k(b,c)}}function f(a){0==a.indentCount&&(a.indentCount++,a.scopes.unshift({offset:a.scopes[0].offset+p.indentUnit}))}function k(a,b){var c=a.peek();if(a.match("/*"))return b.tokenizer=r(a.indentation(),!0),b.tokenizer(a,b);if(a.match("//"))return b.tokenizer=r(a.indentation(),!1),b.tokenizer(a,b);if(a.match("#{"))return b.tokenizer=t(k),"operator";if('"'===c||"'"===c)return a.next(),b.tokenizer=m(c),"string";if(b.cursorHalf){if("#"===c&&
(a.next(),a.match(/[0-9a-fA-F]{6}|[0-9a-fA-F]{3}/))||a.match(/^-?[0-9\.]+/))return h(a)&&(b.cursorHalf=0),"number";if(a.match(/^(px|em|in)\b/))return h(a)&&(b.cursorHalf=0),"unit";if(a.match(u))return h(a)&&(b.cursorHalf=0),"keyword";if(a.match(/^url/)&&"("===a.peek())return b.tokenizer=q,h(a)&&(b.cursorHalf=0),"atom";if("$"===c)return a.next(),a.eatWhile(/[\w-]/),h(a)&&(b.cursorHalf=0),"variable-2";if("!"===c)return a.next(),b.cursorHalf=0,a.match(/^[\w]+/)?"keyword":"operator";if(a.match(v))return h(a)&&
(b.cursorHalf=0),"operator";if(a.eatWhile(/[\w-]/))return h(a)&&(b.cursorHalf=0),e=a.current().toLowerCase(),w.hasOwnProperty(e)?"atom":x.hasOwnProperty(e)?"keyword":n.hasOwnProperty(e)?(b.prevProp=a.current().toLowerCase(),"property"):"tag";if(h(a))return b.cursorHalf=0,null}else{if("-"===c&&a.match(/^-\w+-/))return"meta";if("."===c){a.next();if(a.match(/^[\w-]+/))return f(b),"qualifier";if("#"===a.peek())return f(b),"tag"}if("#"===c){a.next();if(a.match(/^[\w-]+/))return f(b),"builtin";if("#"===
a.peek())return f(b),"tag"}if("$"===c)return a.next(),a.eatWhile(/[\w-]/),"variable-2";if(a.match(/^-?[0-9\.]+/))return"number";if(a.match(/^(px|em|in)\b/))return"unit";if(a.match(u))return"keyword";if(a.match(/^url/)&&"("===a.peek())return b.tokenizer=q,"atom";if("="===c&&a.match(/^=[\w-]+/))return f(b),"meta";if("+"===c&&a.match(/^\+[\w-]+/))return"variable-3";"@"===c&&a.match(/@extend/)&&!a.match(/\s*[\w]/)&&1!=b.scopes.length&&b.scopes.shift();if(a.match(/^@(else if|if|media|else|for|each|while|mixin|function)/))return f(b),
"def";if("@"===c)return a.next(),a.eatWhile(/[\w-]/),"def";if(a.eatWhile(/[\w-]/)){if(a.match(/ *: *[\w-\+\$#!\("']/,!1))return e=a.current().toLowerCase(),n.hasOwnProperty(b.prevProp+"-"+e)?"property":n.hasOwnProperty(e)?(b.prevProp=e,"property"):y.hasOwnProperty(e)?"property":"tag";if(a.match(/ *:/,!1))return f(b),b.cursorHalf=1,b.prevProp=a.current().toLowerCase(),"property";a.match(/ *,/,!1)||f(b);return"tag"}if(":"===c){if(a.match(z))return"variable-3";a.next();b.cursorHalf=1;return"operator"}}if(a.match(v))return"operator";
a.next();return null}var l=g.mimeModes["text/css"],n=l.propertyKeywords||{},x=l.colorKeywords||{},w=l.valueKeywords||{},y=l.fontProperties||{},u=/^true|false|null|auto/,v=/^\(|\)|=|>|<|==|>=|<=|\+|-|\!=|\/|\*|%|and|or|not|;|\{|\}|:/,z=/^::?[a-zA-Z_][\w\-]*/,e;return{startState:function(){return{tokenizer:k,scopes:[{offset:0,type:"sass"}],indentCount:0,cursorHalf:0,definedVars:[],definedMixins:[]}},token:function(a,b){a.sol()&&(b.indentCount=0);var c=b.tokenizer(a,b),d=a.current();"@return"!==d&&"}"!==
d||1==b.scopes.length||b.scopes.shift();if(null!==c){d=a.pos-d.length+p.indentUnit*b.indentCount;for(var f=[],e=0;e<b.scopes.length;e++){var g=b.scopes[e];g.offset<=d&&f.push(g)}b.scopes=f}b.lastToken={style:c,content:a.current()};return c},indent:function(a){return a.scopes[0].offset}}},"css");g.defineMIME("text/x-sass","sass")});