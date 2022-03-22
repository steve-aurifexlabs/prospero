'use strict';(function(f){"object"==typeof exports&&"object"==typeof module?f(require("../../lib/codemirror")):"function"==typeof define&&define.amd?define(["../../lib/codemirror"],f):f(CodeMirror)})(function(f){f.defineMode("julia",function(m,g){function h(b,a){"undefined"===typeof a&&(a="\\b");return new RegExp("^(("+b.join(")|(")+"))"+a)}function k(b,a){"undefined"===typeof a&&(a=0);return b.scopes.length<=a?null:b.scopes[b.scopes.length-(a+1)]}function e(b,a){if(b.match(/^#=/,!1))return a.tokenize=
n,a.tokenize(b,a);var c=a.leavingExpr;b.sol()&&(c=!1);a.leavingExpr=!1;if(c&&b.match(/^'+/))return"operator";if(b.match(/\.{4,}/))return"error";if(b.match(/\.{1,3}/))return"operator";if(b.eatSpace())return null;var d=b.peek();if("#"===d)return b.skipToEnd(),"comment";"["===d&&(a.scopes.push("["),a.nestedArrays++);"("===d&&(a.scopes.push("("),a.nestedGenerators++);if(0<a.nestedArrays&&"]"===d){for(;"["!==k(a);)a.scopes.pop();a.scopes.pop();a.nestedArrays--;a.leavingExpr=!0}if(0<a.nestedGenerators&&
")"===d){for(;"("!==k(a);)a.scopes.pop();a.scopes.pop();a.nestedGenerators--;a.leavingExpr=!0}if(0<a.nestedArrays){if("end"==a.lastToken&&b.match(/^:/))return"operator";if(b.match(/^end/))return"number"}var e;(e=b.match(p,!1))&&a.scopes.push(e[0]);b.match(q,!1)&&a.scopes.pop();if(b.match(/^::(?![:\$])/))return a.tokenize=r,a.tokenize(b,a);if(!c&&b.match(t)||b.match(/:([<>]:|<<=?|>>>?=?|->|\/\/|\.{2,3}|[\.\\%*+\-<>!\/^|&]=?|[~\?\$])/))return"builtin";if(b.match(u))return"operator";if(b.match(/^\.?\d/,
!1)&&(c=RegExp(/^im\b/),d=!1,b.match(/^0x\.[0-9a-f_]+p[\+\-]?[_\d]+/i)&&(d=!0),b.match(/^0x[0-9a-f_]+/i)&&(d=!0),b.match(/^0b[01_]+/i)&&(d=!0),b.match(/^0o[0-7_]+/i)&&(d=!0),b.match(/^(?:(?:\d[_\d]*)?\.(?!\.)(?:\d[_\d]*)?|\d[_\d]*\.(?!\.)(?:\d[_\d]*))?([Eef][\+\-]?[_\d]+)?/i)&&(d=!0),b.match(/^\d[_\d]*(e[\+\-]?\d+)?/i)&&(d=!0),d))return b.match(c),a.leavingExpr=!0,"number";if(b.match(/^'/))return a.tokenize=v,a.tokenize(b,a);if(b.match(w))return a.tokenize=x(b.current()),a.tokenize(b,a);if(b.match(y))return"meta";
if(b.match(z))return null;if(b.match(A))return"keyword";if(b.match(B))return"builtin";c=a.isDefinition||"function"==a.lastToken||"macro"==a.lastToken||"type"==a.lastToken||"struct"==a.lastToken||"immutable"==a.lastToken;if(b.match(C)){if(c){if("."===b.peek())return a.isDefinition=!0,"variable";a.isDefinition=!1;return"def"}if(b.match(/^({[^}]*})*\(/,!1))return a.tokenize=D,a.tokenize(b,a);a.leavingExpr=!0;return"variable"}b.next();return"error"}function D(b,a){var c=b.match(/^(\(\s*)/);c&&(0>a.firstParenPos&&
(a.firstParenPos=a.scopes.length),a.scopes.push("("),a.charsAdvanced+=c[1].length);if("("==k(a)&&b.match(/^\)/)&&(a.scopes.pop(),a.charsAdvanced+=1,a.scopes.length<=a.firstParenPos))return c=b.match(/^(\s*where\s+[^\s=]+)*\s*?=(?!=)/,!1),b.backUp(a.charsAdvanced),a.firstParenPos=-1,a.charsAdvanced=0,a.tokenize=e,c?"def":"builtin";if(b.match(/^$/g,!1)){for(b.backUp(a.charsAdvanced);a.scopes.length>a.firstParenPos;)a.scopes.pop();a.firstParenPos=-1;a.charsAdvanced=0;a.tokenize=e;return"builtin"}a.charsAdvanced+=
b.match(/^([^()]*)/)[1].length;return a.tokenize(b,a)}function r(b,a){b.match(/.*?(?=,|;|{|}|\(|\)|=|$|\s)/);b.match(/^{/)?a.nestedParameters++:b.match(/^}/)&&0<a.nestedParameters&&a.nestedParameters--;0<a.nestedParameters?b.match(/.*?(?={|})/)||b.next():0==a.nestedParameters&&(a.tokenize=e);return"builtin"}function n(b,a){b.match(/^#=/)&&a.nestedComments++;b.match(/.*?(?=(#=|=#))/)||b.skipToEnd();b.match(/^=#/)&&(a.nestedComments--,0==a.nestedComments&&(a.tokenize=e));return"comment"}function v(b,
a){var c=!1,d;if(b.match(E))c=!0;else if(d=b.match(/\\u([a-f0-9]{1,4})(?=')/i)){if(d=parseInt(d[1],16),55295>=d||57344<=d)c=!0,b.next()}else if(d=b.match(/\\U([A-Fa-f0-9]{5,8})(?=')/))d=parseInt(d[1],16),1114111>=d&&(c=!0,b.next());if(c)return a.leavingExpr=!0,a.tokenize=e,"string";b.match(/^[^']+(?=')/)||b.skipToEnd();b.match(/^'/)&&(a.tokenize=e);return"error"}function x(b){'"""'===b.substr(-3)?b='"""':'"'===b.substr(-1)&&(b='"');return function(a,c){if(a.eat("\\"))a.next();else{if(a.match(b))return c.tokenize=
e,c.leavingExpr=!0,"string";a.eat(/[`"]/)}a.eatWhile(/[^\\`"]/);return"string"}}var u=g.operators||h("[<>]: [<>=]= <<=? >>>?=? => -> \\/\\/ [\\\\%*+\\-<>!=\\/^|&\\u00F7\\u22BB]=? \\? \\$ ~ : \\u00D7 \\u2208 \\u2209 \\u220B \\u220C \\u2218 \\u221A \\u221B \\u2229 \\u222A \\u2260 \\u2264 \\u2265 \\u2286 \\u2288 \\u228A \\u22C5 \\b(in|isa)\\b(?!.?\\()".split(" "),""),z=g.delimiters||/^[;,()[\]{}]/,C=g.identifiers||/^[_A-Za-z\u00A1-\u2217\u2219-\uFFFF][\w\u00A1-\u2217\u2219-\uFFFF]*!*/,E=h(["\\\\[0-7]{1,3}",
"\\\\x[A-Fa-f0-9]{1,2}","\\\\[abefnrtv0%?'\"\\\\]","([^\\u0027\\u005C\\uD800-\\uDFFF]|[\\uD800-\\uDFFF][\\uDC00-\\uDFFF])"],"'");g="if else elseif while for begin let end do try catch finally return break continue global local const export import importall using function where macro module baremodule struct type mutable immutable quote typealias abstract primitive bitstype".split(" ");var l=["true","false","nothing","NaN","Inf"];f.registerHelper("hintWords","julia",g.concat(l));var p=h("begin function type struct immutable let macro for while quote if else elseif try finally catch do".split(" ")),
q=h(["end","else","elseif","catch","finally"]),A=h(g),B=h(l),y=/^@[_A-Za-z][\w]*/,t=/^:[_A-Za-z\u00A1-\uFFFF][\w\u00A1-\uFFFF]*!*/,w=/^(`|([_A-Za-z\u00A1-\uFFFF]*"("")?))/;return{startState:function(){return{tokenize:e,scopes:[],lastToken:null,leavingExpr:!1,isDefinition:!1,nestedArrays:0,nestedComments:0,nestedGenerators:0,nestedParameters:0,charsAdvanced:0,firstParenPos:-1}},token:function(b,a){var c=a.tokenize(b,a);(b=b.current())&&c&&(a.lastToken=b);return c},indent:function(b,a){var c=0;if("]"===
a||")"===a||"end"===a||"else"===a||"catch"===a||"elseif"===a||"finally"===a)c=-1;return(b.scopes.length+c)*m.indentUnit},electricInput:/\b(end|else|catch|finally)\b/,blockCommentStart:"#=",blockCommentEnd:"=#",lineComment:"#",closeBrackets:'()[]{}""',fold:"indent"}});f.defineMIME("text/x-julia","julia")});
