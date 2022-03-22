'use strict';(function(c){"object"==typeof exports&&"object"==typeof module?c(require("../../lib/codemirror")):"function"==typeof define&&define.amd?define(["../../lib/codemirror"],c):c(CodeMirror)})(function(c){c.defineMode("yaml",function(){var c=/\b((true)|(false)|(on)|(off)|(yes)|(no))$/i;return{token:function(b,a){var d=b.peek(),e=a.escaped;a.escaped=!1;if("#"==d&&(0==b.pos||/\s/.test(b.string.charAt(b.pos-1))))return b.skipToEnd(),"comment";if(b.match(/^('([^']|\\.)*'?|"([^"]|\\.)*"?)/))return"string";
if(a.literal&&b.indentation()>a.keyCol)return b.skipToEnd(),"string";a.literal&&(a.literal=!1);if(b.sol()){a.keyCol=0;a.pair=!1;a.pairStart=!1;if(b.match(/---/)||b.match(/\.\.\./))return"def";if(b.match(/\s*-\s+/))return"meta"}if(b.match(/^(\{|\}|\[|\])/))return"{"==d?a.inlinePairs++:"}"==d?a.inlinePairs--:"["==d?a.inlineList++:a.inlineList--,"meta";if(0<a.inlineList&&!e&&","==d)return b.next(),"meta";if(0<a.inlinePairs&&!e&&","==d)return a.keyCol=0,a.pair=!1,a.pairStart=!1,b.next(),"meta";if(a.pairStart){if(b.match(/^\s*(\||>)\s*/))return a.literal=
!0,"meta";if(b.match(/^\s*(&|\*)[a-z0-9\._-]+\b/i))return"variable-2";if(0==a.inlinePairs&&b.match(/^\s*-?[0-9\.,]+\s?$/)||0<a.inlinePairs&&b.match(/^\s*-?[0-9\.,]+\s?(?=(,|}))/))return"number";if(b.match(c))return"keyword"}if(!a.pair&&b.match(/^\s*(?:[,\[\]{}&*!|>'"%@`][^\s'":]|[^,\[\]{}#&*!|>'"%@`])[^#]*?(?=\s*:($|\s))/))return a.pair=!0,a.keyCol=b.indentation(),"atom";if(a.pair&&b.match(/^:\s*/))return a.pairStart=!0,"meta";a.pairStart=!1;a.escaped="\\"==d;b.next();return null},startState:function(){return{pair:!1,
pairStart:!1,keyCol:0,inlinePairs:0,inlineList:0,literal:!1,escaped:!1}},lineComment:"#",fold:"indent"}});c.defineMIME("text/x-yaml","yaml");c.defineMIME("text/yaml","yaml")});
