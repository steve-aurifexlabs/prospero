'use strict';(function(c){"object"==typeof exports&&"object"==typeof module?c(require("../../lib/codemirror")):"function"==typeof define&&define.amd?define(["../../lib/codemirror"],c):c(CodeMirror)})(function(c){c.defineMode("asterisk",function(){function c(a,b){var d=a.next();if(b.blockComment)return"-"==d&&a.match("-;",!0)?b.blockComment=!1:a.skipTo("--;")?(a.next(),a.next(),a.next(),b.blockComment=!1):a.skipToEnd(),"comment";if(";"==d){if(a.match("--",!0)&&!a.match("-",!1))return b.blockComment=
!0,"comment";a.skipToEnd();return"comment"}if("["==d)return a.skipTo("]"),a.eat("]"),"header";if('"'==d)return a.skipTo('"'),"string";if("'"==d)return a.skipTo("'"),"string-2";if("#"==d){a.eatWhile(/\w/);var c=a.current();if(-1!==e.indexOf(c))return a.skipToEnd(),"strong"}if("$"==d&&"{"==a.peek())return a.skipTo("}"),a.eat("}"),"variable-3";a.eatWhile(/\w/);c=a.current();if(-1!==f.indexOf(c)){b.extenStart=!0;switch(c){case "same":b.extenSame=!0;break;case "include":case "switch":case "ignorepat":b.extenInclude=
!0}return"atom"}}var f=["exten","same","include","ignorepat","switch"],e=["#include","#exec"],g="addqueuemember adsiprog aelsub agentlogin agentmonitoroutgoing agi alarmreceiver amd answer authenticate background backgrounddetect bridge busy callcompletioncancel callcompletionrequest celgenuserevent changemonitor chanisavail channelredirect chanspy clearhash confbridge congestion continuewhile controlplayback dahdiacceptr2call dahdibarge dahdiras dahdiscan dahdisendcallreroutingfacility dahdisendkeypadfacility datetime dbdel dbdeltree deadagi dial dictate directory disa dumpchan eagi echo endwhile exec execif execiftime exitwhile extenspy externalivr festival flash followme forkcdr getcpeid gosub gosubif goto gotoif gotoiftime hangup iax2provision ices importvar incomplete ivrdemo jabberjoin jabberleave jabbersend jabbersendgroup jabberstatus jack log macro macroexclusive macroexit macroif mailboxexists meetme meetmeadmin meetmechanneladmin meetmecount milliwatt minivmaccmess minivmdelete minivmgreet minivmmwi minivmnotify minivmrecord mixmonitor monitor morsecode mp3player mset musiconhold nbscat nocdr noop odbc odbc odbcfinish originate ospauth ospfinish osplookup ospnext page park parkandannounce parkedcall pausemonitor pausequeuemember pickup pickupchan playback playtones privacymanager proceeding progress queue queuelog raiseexception read readexten readfile receivefax receivefax receivefax record removequeuemember resetcdr retrydial return ringing sayalpha saycountedadj saycountednoun saycountpl saydigits saynumber sayphonetic sayunixtime senddtmf sendfax sendfax sendfax sendimage sendtext sendurl set setamaflags setcallerpres setmusiconhold sipaddheader sipdtmfmode sipremoveheader skel slastation slatrunk sms softhangup speechactivategrammar speechbackground speechcreate speechdeactivategrammar speechdestroy speechloadgrammar speechprocessingsound speechstart speechunloadgrammar stackpop startmusiconhold stopmixmonitor stopmonitor stopmusiconhold stopplaytones system testclient testserver transfer tryexec trysystem unpausemonitor unpausequeuemember userevent verbose vmauthenticate vmsayname voicemail voicemailmain wait waitexten waitfornoise waitforring waitforsilence waitmusiconhold waituntil while zapateller".split(" ");
return{startState:function(){return{blockComment:!1,extenStart:!1,extenSame:!1,extenInclude:!1,extenExten:!1,extenPriority:!1,extenApplication:!1}},token:function(a,b){if(a.eatSpace())return null;if(b.extenStart){a.eatWhile(/[^\s]/);var d=a.current();if(/^=>?$/.test(d))return b.extenExten=!0,b.extenStart=!1,"strong";b.extenStart=!1;a.skipToEnd();return"error"}if(b.extenExten)return b.extenExten=!1,b.extenPriority=!0,a.eatWhile(/[^,]/),b.extenInclude&&(a.skipToEnd(),b.extenPriority=!1,b.extenInclude=
!1),b.extenSame&&(b.extenPriority=!1,b.extenSame=!1,b.extenApplication=!0),"tag";if(b.extenPriority){b.extenPriority=!1;b.extenApplication=!0;a.next();if(b.extenSame)return null;a.eatWhile(/[^,]/);return"number"}if(b.extenApplication){a.eatWhile(/,/);d=a.current();if(","===d)return null;a.eatWhile(/\w/);d=a.current().toLowerCase();b.extenApplication=!1;if(-1!==g.indexOf(d))return"def strong"}else return c(a,b);return null},blockCommentStart:";--",blockCommentEnd:"--;",lineComment:";"}});c.defineMIME("text/x-asterisk",
"asterisk")});
