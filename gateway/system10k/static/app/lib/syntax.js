// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
  if (typeof exports == "object" && typeof module == "object") // CommonJS
    mod(require("../../lib/codemirror"));
  else if (typeof define == "function" && define.amd) // AMD
    define(["../../lib/codemirror"], mod);
  else // Plain browser env
    mod(CodeMirror);
})(function(CodeMirror) {
"use strict";

CodeMirror.defineMode("javascript", function(config, parserConfig) {
  var indentUnit = config.indentUnit;
  var statementIndent = parserConfig.statementIndent;
  var jsonldMode = parserConfig.jsonld;
  var jsonMode = parserConfig.json || jsonldMode;
  var isTS = parserConfig.typescript;
  var wordRE = parserConfig.wordCharacters || /[\w$\xa1-\uffff]/;

  // Tokenizer

  var keywords = function(){
    function kw(type) {return {type: type, style: "keyword"};}
    var A = kw("keyword a"), B = kw("keyword b"), C = kw("keyword c"), D = kw("keyword d");
    var operator = kw("operator"), atom = {type: "atom", style: "atom"};

    return {
      "if": kw("if"), "while": A, "with": A, "else": B, "do": B, "try": B, "finally": B,
      "return": D, "break": D, "continue": D, "new": kw("new"), "delete": C, "void": C, "throw": C,
      "debugger": kw("debugger"), "var": kw("var"), "const": kw("var"), "let": kw("var"),
      "function": kw("function"), "catch": kw("catch"),
      "for": kw("for"), "switch": kw("switch"), "case": kw("case"), "default": kw("default"),
      "in": operator, "typeof": operator, "instanceof": operator,
      "true": atom, "false": atom, "null": atom, "undefined": atom, "NaN": atom, "Infinity": atom,
      "this": kw("this"), "class": kw("class"), "super": kw("atom"),
      "yield": C, "export": kw("export"), "import": kw("import"), "extends": C,
      "await": C
    };
  }();

  var isOperatorChar = /[+\-*&%=<>!?|~^@]/;
  var isJsonldKeyword = /^@(context|id|value|language|type|container|list|set|reverse|index|base|vocab|graph)"/;

  function readRegexp(stream) {
    var escaped = false, next, inSet = false;
    while ((next = stream.next()) != null) {
      if (!escaped) {
        if (next == "/" && !inSet) return;
        if (next == "[") inSet = true;
        else if (inSet && next == "]") inSet = false;
      }
      escaped = !escaped && next == "\\";
    }
  }

  // Used as scratch variables to communicate multiple values without
  // consing up tons of objects.
  var type, content;
  function ret(tp, style, cont) {
    type = tp; content = cont;
    return style;
  }
  function tokenBase(stream, state) {
    var ch = stream.next();
    if (ch == '"' || ch == "'") {
      state.tokenize = tokenString(ch);
      return state.tokenize(stream, state);
    } else if (ch == "." && stream.match(/^\d[\d_]*(?:[eE][+\-]?[\d_]+)?/)) {
      return ret("number", "number");
    } else if (ch == "." && stream.match("..")) {
      return ret("spread", "meta");
    } else if (/[\[\]{}\(\),;\:\.]/.test(ch)) {
      return ret(ch);
    } else if (ch == "=" && stream.eat(">")) {
      return ret("=>", "operator");
    } else if (ch == "0" && stream.match(/^(?:x[\dA-Fa-f_]+|o[0-7_]+|b[01_]+)n?/)) {
      return ret("number", "number");
    } else if (/\d/.test(ch)) {
      stream.match(/^[\d_]*(?:n|(?:\.[\d_]*)?(?:[eE][+\-]?[\d_]+)?)?/);
      return ret("number", "number");
    } else if (ch == "/") {
      if (stream.eat("*")) {
        state.tokenize = tokenComment;
        return tokenComment(stream, state);
      } else if (stream.eat("/")) {
        stream.skipToEnd();
        return ret("comment", "comment");
      } else if (expressionAllowed(stream, state, 1)) {
        readRegexp(stream);
        stream.match(/^\b(([gimyus])(?![gimyus]*\2))+\b/);
        return ret("regexp", "string-2");
      } else {
        stream.eat("=");
        return ret("operator", "operator", stream.current());
      }
    } else if (ch == "`") {
      state.tokenize = tokenQuasi;
      return tokenQuasi(stream, state);
    } else if (ch == "#" && stream.peek() == "!") {
      stream.skipToEnd();
      return ret("meta", "meta");
    } else if (ch == "#" && stream.eatWhile(wordRE)) {
      return ret("variable", "property")
    } else if (ch == "<" && stream.match("!--") || ch == "-" && stream.match("->")) {
      stream.skipToEnd()
      return ret("comment", "comment")
    } else if (isOperatorChar.test(ch)) {
      if (ch != ">" || !state.lexical || state.lexical.type != ">") {
        if (stream.eat("=")) {
          if (ch == "!" || ch == "=") stream.eat("=")
        } else if (/[<>*+\-]/.test(ch)) {
          stream.eat(ch)
          if (ch == ">") stream.eat(ch)
        }
      }
      if (ch == "?" && stream.eat(".")) return ret(".")
      return ret("operator", "operator", stream.current());
    } else if (wordRE.test(ch)) {
      stream.eatWhile(wordRE);
      var word = stream.current()
      if (state.lastType != ".") {
        if (keywords.propertyIsEnumerable(word)) {
          var kw = keywords[word]
          return ret(kw.type, kw.style, word)
        }
        if (word == "async" && stream.match(/^(\s|\/\*.*?\*\/)*[\[\(\w]/, false))
          return ret("async", "keyword", word)
      }
      return ret("variable", "variable", word)
    }
  }

  function tokenString(quote) {
    return function(stream, state) {
      var escaped = false, next;
      if (jsonldMode && stream.peek() == "@" && stream.match(isJsonldKeyword)){
        state.tokenize = tokenBase;
        return ret("jsonld-keyword", "meta");
      }
      while ((next = stream.next()) != null) {
        if (next == quote && !escaped) break;
        escaped = !escaped && next == "\\";
      }
      if (!escaped) state.tokenize = tokenBase;
      return ret("string", "string");
    };
  }

  function tokenComment(stream, state) {
    var maybeEnd = false, ch;
    while (ch = stream.next()) {
      if (ch == "/" && maybeEnd) {
        state.tokenize = tokenBase;
        break;
      }
      maybeEnd = (ch == "*");
    }
    return ret("comment", "comment");
  }

  function tokenQuasi(stream, state) {
    var escaped = false, next;
    while ((next = stream.next()) != null) {
      if (!escaped && (next == "`" || next == "$" && stream.eat("{"))) {
        state.tokenize = tokenBase;
        break;
      }
      escaped = !escaped && next == "\\";
    }
    return ret("quasi", "string-2", stream.current());
  }

  var brackets = "([{}])";
  // This is a crude lookahead trick to try and notice that we're
  // parsing the argument patterns for a fat-arrow function before we
  // actually hit the arrow token. It only works if the arrow is on
  // the same line as the arguments and there's no strange noise
  // (comments) in between. Fallback is to only notice when we hit the
  // arrow, and not declare the arguments as locals for the arrow
  // body.
  function findFatArrow(stream, state) {
    if (state.fatArrowAt) state.fatArrowAt = null;
    var arrow = stream.string.indexOf("=>", stream.start);
    if (arrow < 0) return;

    if (isTS) { // Try to skip TypeScript return type declarations after the arguments
      var m = /:\s*(?:\w+(?:<[^>]*>|\[\])?|\{[^}]*\})\s*$/.exec(stream.string.slice(stream.start, arrow))
      if (m) arrow = m.index
    }

    var depth = 0, sawSomething = false;
    for (var pos = arrow - 1; pos >= 0; --pos) {
      var ch = stream.string.charAt(pos);
      var bracket = brackets.indexOf(ch);
      if (bracket >= 0 && bracket < 3) {
        if (!depth) { ++pos; break; }
        if (--depth == 0) { if (ch == "(") sawSomething = true; break; }
      } else if (bracket >= 3 && bracket < 6) {
        ++depth;
      } else if (wordRE.test(ch)) {
        sawSomething = true;
      } else if (/["'\/`]/.test(ch)) {
        for (;; --pos) {
          if (pos == 0) return
          var next = stream.string.charAt(pos - 1)
          if (next == ch && stream.string.charAt(pos - 2) != "\\") { pos--; break }
        }
      } else if (sawSomething && !depth) {
        ++pos;
        break;
      }
    }
    if (sawSomething && !depth) state.fatArrowAt = pos;
  }

  // Parser

  var atomicTypes = {"atom": true, "number": true, "variable": true, "string": true, "regexp": true, "this": true, "jsonld-keyword": true};

  function JSLexical(indented, column, type, align, prev, info) {
    this.indented = indented;
    this.column = column;
    this.type = type;
    this.prev = prev;
    this.info = info;
    if (align != null) this.align = align;
  }

  function inScope(state, varname) {
    for (var v = state.localVars; v; v = v.next)
      if (v.name == varname) return true;
    for (var cx = state.context; cx; cx = cx.prev) {
      for (var v = cx.vars; v; v = v.next)
        if (v.name == varname) return true;
    }
  }

  function parseJS(state, style, type, content, stream) {
    var cc = state.cc;
    // Communicate our context to the combinators.
    // (Less wasteful than consing up a hundred closures on every call.)
    cx.state = state; cx.stream = stream; cx.marked = null, cx.cc = cc; cx.style = style;

    if (!state.lexical.hasOwnProperty("align"))
      state.lexical.align = true;

    while(true) {
      var combinator = cc.length ? cc.pop() : jsonMode ? expression : statement;
      if (combinator(type, content)) {
        while(cc.length && cc[cc.length - 1].lex)
          cc.pop()();
        if (cx.marked) return cx.marked;
        if (type == "variable" && inScope(state, content)) return "variable-2";
        return style;
      }
    }
  }

  // Combinator utils

  var cx = {state: null, column: null, marked: null, cc: null};
  function pass() {
    for (var i = arguments.length - 1; i >= 0; i--) cx.cc.push(arguments[i]);
  }
  function cont() {
    pass.apply(null, arguments);
    return true;
  }
  function inList(name, list) {
    for (var v = list; v; v = v.next) if (v.name == name) return true
    return false;
  }
  function register(varname) {
    var state = cx.state;
    cx.marked = "def";
    if (state.context) {
      if (state.lexical.info == "var" && state.context && state.context.block) {
        // FIXME function decls are also not block scoped
        var newContext = registerVarScoped(varname, state.context)
        if (newContext != null) {
          state.context = newContext
          return
        }
      } else if (!inList(varname, state.localVars)) {
        state.localVars = new Var(varname, state.localVars)
        return
      }
    }
    // Fall through means this is global
    if (parserConfig.globalVars && !inList(varname, state.globalVars))
      state.globalVars = new Var(varname, state.globalVars)
  }
  function registerVarScoped(varname, context) {
    if (!context) {
      return null
    } else if (context.block) {
      var inner = registerVarScoped(varname, context.prev)
      if (!inner) return null
      if (inner == context.prev) return context
      return new Context(inner, context.vars, true)
    } else if (inList(varname, context.vars)) {
      return context
    } else {
      return new Context(context.prev, new Var(varname, context.vars), false)
    }
  }

  function isModifier(name) {
    return name == "public" || name == "private" || name == "protected" || name == "abstract" || name == "readonly"
  }

  // Combinators

  function Context(prev, vars, block) { this.prev = prev; this.vars = vars; this.block = block }
  function Var(name, next) { this.name = name; this.next = next }

  var defaultVars = new Var("this", new Var("arguments", null))
  function pushcontext() {
    cx.state.context = new Context(cx.state.context, cx.state.localVars, false)
    cx.state.localVars = defaultVars
  }
  function pushblockcontext() {
    cx.state.context = new Context(cx.state.context, cx.state.localVars, true)
    cx.state.localVars = null
  }
  function popcontext() {
    cx.state.localVars = cx.state.context.vars
    cx.state.context = cx.state.context.prev
  }
  popcontext.lex = true
  function pushlex(type, info) {
    var result = function() {
      var state = cx.state, indent = state.indented;
      if (state.lexical.type == "stat") indent = state.lexical.indented;
      else for (var outer = state.lexical; outer && outer.type == ")" && outer.align; outer = outer.prev)
        indent = outer.indented;
      state.lexical = new JSLexical(indent, cx.stream.column(), type, null, state.lexical, info);
    };
    result.lex = true;
    return result;
  }
  function poplex() {
    var state = cx.state;
    if (state.lexical.prev) {
      if (state.lexical.type == ")")
        state.indented = state.lexical.indented;
      state.lexical = state.lexical.prev;
    }
  }
  poplex.lex = true;

  function expect(wanted) {
    function exp(type) {
      if (type == wanted) return cont();
      else if (wanted == ";" || type == "}" || type == ")" || type == "]") return pass();
      else return cont(exp);
    };
    return exp;
  }

  function statement(type, value) {
    if (type == "var") return cont(pushlex("vardef", value), vardef, expect(";"), poplex);
    if (type == "keyword a") return cont(pushlex("form"), parenExpr, statement, poplex);
    if (type == "keyword b") return cont(pushlex("form"), statement, poplex);
    if (type == "keyword d") return cx.stream.match(/^\s*$/, false) ? cont() : cont(pushlex("stat"), maybeexpression, expect(";"), poplex);
    if (type == "debugger") return cont(expect(";"));
    if (type == "{") return cont(pushlex("}"), pushblockcontext, block, poplex, popcontext);
    if (type == ";") return cont();
    if (type == "if") {
      if (cx.state.lexical.info == "else" && cx.state.cc[cx.state.cc.length - 1] == poplex)
        cx.state.cc.pop()();
      return cont(pushlex("form"), parenExpr, statement, poplex, maybeelse);
    }
    if (type == "function") return cont(functiondef);
    if (type == "for") return cont(pushlex("form"), forspec, statement, poplex);
    if (type == "class" || (isTS && value == "interface")) {
      cx.marked = "keyword"
      return cont(pushlex("form", type == "class" ? type : value), className, poplex)
    }
    if (type == "variable") {
      if (isTS && value == "declare") {
        cx.marked = "keyword"
        return cont(statement)
      } else if (isTS && (value == "module" || value == "enum" || value == "type") && cx.stream.match(/^\s*\w/, false)) {
        cx.marked = "keyword"
        if (value == "enum") return cont(enumdef);
        else if (value == "type") return cont(typename, expect("operator"), typeexpr, expect(";"));
        else return cont(pushlex("form"), pattern, expect("{"), pushlex("}"), block, poplex, poplex)
      } else if (isTS && value == "namespace") {
        cx.marked = "keyword"
        return cont(pushlex("form"), expression, statement, poplex)
      } else if (isTS && value == "abstract") {
        cx.marked = "keyword"
        return cont(statement)
      } else {
        return cont(pushlex("stat"), maybelabel);
      }
    }
    if (type == "switch") return cont(pushlex("form"), parenExpr, expect("{"), pushlex("}", "switch"), pushblockcontext,
                                      block, poplex, poplex, popcontext);
    if (type == "case") return cont(expression, expect(":"));
    if (type == "default") return cont(expect(":"));
    if (type == "catch") return cont(pushlex("form"), pushcontext, maybeCatchBinding, statement, poplex, popcontext);
    if (type == "export") return cont(pushlex("stat"), afterExport, poplex);
    if (type == "import") return cont(pushlex("stat"), afterImport, poplex);
    if (type == "async") return cont(statement)
    if (value == "@") return cont(expression, statement)
    return pass(pushlex("stat"), expression, expect(";"), poplex);
  }
  function maybeCatchBinding(type) {
    if (type == "(") return cont(funarg, expect(")"))
  }
  function expression(type, value) {
    return expressionInner(type, value, false);
  }
  function expressionNoComma(type, value) {
    return expressionInner(type, value, true);
  }
  function parenExpr(type) {
    if (type != "(") return pass()
    return cont(pushlex(")"), maybeexpression, expect(")"), poplex)
  }
  function expressionInner(type, value, noComma) {
    if (cx.state.fatArrowAt == cx.stream.start) {
      var body = noComma ? arrowBodyNoComma : arrowBody;
      if (type == "(") return cont(pushcontext, pushlex(")"), commasep(funarg, ")"), poplex, expect("=>"), body, popcontext);
      else if (type == "variable") return pass(pushcontext, pattern, expect("=>"), body, popcontext);
    }

    var maybeop = noComma ? maybeoperatorNoComma : maybeoperatorComma;
    if (atomicTypes.hasOwnProperty(type)) return cont(maybeop);
    if (type == "function") return cont(functiondef, maybeop);
    if (type == "class" || (isTS && value == "interface")) { cx.marked = "keyword"; return cont(pushlex("form"), classExpression, poplex); }
    if (type == "keyword c" || type == "async") return cont(noComma ? expressionNoComma : expression);
    if (type == "(") return cont(pushlex(")"), maybeexpression, expect(")"), poplex, maybeop);
    if (type == "operator" || type == "spread") return cont(noComma ? expressionNoComma : expression);
    if (type == "[") return cont(pushlex("]"), arrayLiteral, poplex, maybeop);
    if (type == "{") return contCommasep(objprop, "}", null, maybeop);
    if (type == "quasi") return pass(quasi, maybeop);
    if (type == "new") return cont(maybeTarget(noComma));
    if (type == "import") return cont(expression);
    return cont();
  }
  function maybeexpression(type) {
    if (type.match(/[;\}\)\],]/)) return pass();
    return pass(expression);
  }

  function maybeoperatorComma(type, value) {
    if (type == ",") return cont(maybeexpression);
    return maybeoperatorNoComma(type, value, false);
  }
  function maybeoperatorNoComma(type, value, noComma) {
    var me = noComma == false ? maybeoperatorComma : maybeoperatorNoComma;
    var expr = noComma == false ? expression : expressionNoComma;
    if (type == "=>") return cont(pushcontext, noComma ? arrowBodyNoComma : arrowBody, popcontext);
    if (type == "operator") {
      if (/\+\+|--/.test(value) || isTS && value == "!") return cont(me);
      if (isTS && value == "<" && cx.stream.match(/^([^<>]|<[^<>]*>)*>\s*\(/, false))
        return cont(pushlex(">"), commasep(typeexpr, ">"), poplex, me);
      if (value == "?") return cont(expression, expect(":"), expr);
      return cont(expr);
    }
    if (type == "quasi") { return pass(quasi, me); }
    if (type == ";") return;
    if (type == "(") return contCommasep(expressionNoComma, ")", "call", me);
    if (type == ".") return cont(property, me);
    if (type == "[") return cont(pushlex("]"), maybeexpression, expect("]"), poplex, me);
    if (isTS && value == "as") { cx.marked = "keyword"; return cont(typeexpr, me) }
    if (type == "regexp") {
      cx.state.lastType = cx.marked = "operator"
      cx.stream.backUp(cx.stream.pos - cx.stream.start - 1)
      return cont(expr)
    }
  }
  function quasi(type, value) {
    if (type != "quasi") return pass();
    if (value.slice(value.length - 2) != "${") return cont(quasi);
    return cont(expression, continueQuasi);
  }
  function continueQuasi(type) {
    if (type == "}") {
      cx.marked = "string-2";
      cx.state.tokenize = tokenQuasi;
      return cont(quasi);
    }
  }
  function arrowBody(type) {
    findFatArrow(cx.stream, cx.state);
    return pass(type == "{" ? statement : expression);
  }
  function arrowBodyNoComma(type) {
    findFatArrow(cx.stream, cx.state);
    return pass(type == "{" ? statement : expressionNoComma);
  }
  function maybeTarget(noComma) {
    return function(type) {
      if (type == ".") return cont(noComma ? targetNoComma : target);
      else if (type == "variable" && isTS) return cont(maybeTypeArgs, noComma ? maybeoperatorNoComma : maybeoperatorComma)
      else return pass(noComma ? expressionNoComma : expression);
    };
  }
  function target(_, value) {
    if (value == "target") { cx.marked = "keyword"; return cont(maybeoperatorComma); }
  }
  function targetNoComma(_, value) {
    if (value == "target") { cx.marked = "keyword"; return cont(maybeoperatorNoComma); }
  }
  function maybelabel(type) {
    if (type == ":") return cont(poplex, statement);
    return pass(maybeoperatorComma, expect(";"), poplex);
  }
  function property(type) {
    if (type == "variable") {cx.marked = "property"; return cont();}
  }
  function objprop(type, value) {
    if (type == "async") {
      cx.marked = "property";
      return cont(objprop);
    } else if (type == "variable" || cx.style == "keyword") {
      cx.marked = "property";
      if (value == "get" || value == "set") return cont(getterSetter);
      var m // Work around fat-arrow-detection complication for detecting typescript typed arrow params
      if (isTS && cx.state.fatArrowAt == cx.stream.start && (m = cx.stream.match(/^\s*:\s*/, false)))
        cx.state.fatArrowAt = cx.stream.pos + m[0].length
      return cont(afterprop);
    } else if (type == "number" || type == "string") {
      cx.marked = jsonldMode ? "property" : (cx.style + " property");
      return cont(afterprop);
    } else if (type == "jsonld-keyword") {
      return cont(afterprop);
    } else if (isTS && isModifier(value)) {
      cx.marked = "keyword"
      return cont(objprop)
    } else if (type == "[") {
      return cont(expression, maybetype, expect("]"), afterprop);
    } else if (type == "spread") {
      return cont(expressionNoComma, afterprop);
    } else if (value == "*") {
      cx.marked = "keyword";
      return cont(objprop);
    } else if (type == ":") {
      return pass(afterprop)
    }
  }
  function getterSetter(type) {
    if (type != "variable") return pass(afterprop);
    cx.marked = "property";
    return cont(functiondef);
  }
  function afterprop(type) {
    if (type == ":") return cont(expressionNoComma);
    if (type == "(") return pass(functiondef);
  }
  function commasep(what, end, sep) {
    function proceed(type, value) {
      if (sep ? sep.indexOf(type) > -1 : type == ",") {
        var lex = cx.state.lexical;
        if (lex.info == "call") lex.pos = (lex.pos || 0) + 1;
        return cont(function(type, value) {
          if (type == end || value == end) return pass()
          return pass(what)
        }, proceed);
      }
      if (type == end || value == end) return cont();
      if (sep && sep.indexOf(";") > -1) return pass(what)
      return cont(expect(end));
    }
    return function(type, value) {
      if (type == end || value == end) return cont();
      return pass(what, proceed);
    };
  }
  function contCommasep(what, end, info) {
    for (var i = 3; i < arguments.length; i++)
      cx.cc.push(arguments[i]);
    return cont(pushlex(end, info), commasep(what, end), poplex);
  }
  function block(type) {
    if (type == "}") return cont();
    return pass(statement, block);
  }
  function maybetype(type, value) {
    if (isTS) {
      if (type == ":") return cont(typeexpr);
      if (value == "?") return cont(maybetype);
    }
  }
  function maybetypeOrIn(type, value) {
    if (isTS && (type == ":" || value == "in")) return cont(typeexpr)
  }
  function mayberettype(type) {
    if (isTS && type == ":") {
      if (cx.stream.match(/^\s*\w+\s+is\b/, false)) return cont(expression, isKW, typeexpr)
      else return cont(typeexpr)
    }
  }
  function isKW(_, value) {
    if (value == "is") {
      cx.marked = "keyword"
      return cont()
    }
  }
  function typeexpr(type, value) {
    if (value == "keyof" || value == "typeof" || value == "infer") {
      cx.marked = "keyword"
      return cont(value == "typeof" ? expressionNoComma : typeexpr)
    }
    if (type == "variable" || value == "void") {
      cx.marked = "type"
      return cont(afterType)
    }
    if (value == "|" || value == "&") return cont(typeexpr)
    if (type == "string" || type == "number" || type == "atom") return cont(afterType);
    if (type == "[") return cont(pushlex("]"), commasep(typeexpr, "]", ","), poplex, afterType)
    if (type == "{") return cont(pushlex("}"), commasep(typeprop, "}", ",;"), poplex, afterType)
    if (type == "(") return cont(commasep(typearg, ")"), maybeReturnType, afterType)
    if (type == "<") return cont(commasep(typeexpr, ">"), typeexpr)
  }
  function maybeReturnType(type) {
    if (type == "=>") return cont(typeexpr)
  }
  function typeprop(type, value) {
    if (type == "variable" || cx.style == "keyword") {
      cx.marked = "property"
      return cont(typeprop)
    } else if (value == "?" || type == "number" || type == "string") {
      return cont(typeprop)
    } else if (type == ":") {
      return cont(typeexpr)
    } else if (type == "[") {
      return cont(expect("variable"), maybetypeOrIn, expect("]"), typeprop)
    } else if (type == "(") {
      return pass(functiondecl, typeprop)
    }
  }
  function typearg(type, value) {
    if (type == "variable" && cx.stream.match(/^\s*[?:]/, false) || value == "?") return cont(typearg)
    if (type == ":") return cont(typeexpr)
    if (type == "spread") return cont(typearg)
    return pass(typeexpr)
  }
  function afterType(type, value) {
    if (value == "<") return cont(pushlex(">"), commasep(typeexpr, ">"), poplex, afterType)
    if (value == "|" || type == "." || value == "&") return cont(typeexpr)
    if (type == "[") return cont(typeexpr, expect("]"), afterType)
    if (value == "extends" || value == "implements") { cx.marked = "keyword"; return cont(typeexpr) }
    if (value == "?") return cont(typeexpr, expect(":"), typeexpr)
  }
  function maybeTypeArgs(_, value) {
    if (value == "<") return cont(pushlex(">"), commasep(typeexpr, ">"), poplex, afterType)
  }
  function typeparam() {
    return pass(typeexpr, maybeTypeDefault)
  }
  function maybeTypeDefault(_, value) {
    if (value == "=") return cont(typeexpr)
  }
  function vardef(_, value) {
    if (value == "enum") {cx.marked = "keyword"; return cont(enumdef)}
    return pass(pattern, maybetype, maybeAssign, vardefCont);
  }
  function pattern(type, value) {
    if (isTS && isModifier(value)) { cx.marked = "keyword"; return cont(pattern) }
    if (type == "variable") { register(value); return cont(); }
    if (type == "spread") return cont(pattern);
    if (type == "[") return contCommasep(eltpattern, "]");
    if (type == "{") return contCommasep(proppattern, "}");
  }
  function proppattern(type, value) {
    if (type == "variable" && !cx.stream.match(/^\s*:/, false)) {
      register(value);
      return cont(maybeAssign);
    }
    if (type == "variable") cx.marked = "property";
    if (type == "spread") return cont(pattern);
    if (type == "}") return pass();
    if (type == "[") return cont(expression, expect(']'), expect(':'), proppattern);
    return cont(expect(":"), pattern, maybeAssign);
  }
  function eltpattern() {
    return pass(pattern, maybeAssign)
  }
  function maybeAssign(_type, value) {
    if (value == "=") return cont(expressionNoComma);
  }
  function vardefCont(type) {
    if (type == ",") return cont(vardef);
  }
  function maybeelse(type, value) {
    if (type == "keyword b" && value == "else") return cont(pushlex("form", "else"), statement, poplex);
  }
  function forspec(type, value) {
    if (value == "await") return cont(forspec);
    if (type == "(") return cont(pushlex(")"), forspec1, poplex);
  }
  function forspec1(type) {
    if (type == "var") return cont(vardef, forspec2);
    if (type == "variable") return cont(forspec2);
    return pass(forspec2)
  }
  function forspec2(type, value) {
    if (type == ")") return cont()
    if (type == ";") return cont(forspec2)
    if (value == "in" || value == "of") { cx.marked = "keyword"; return cont(expression, forspec2) }
    return pass(expression, forspec2)
  }
  function functiondef(type, value) {
    if (value == "*") {cx.marked = "keyword"; return cont(functiondef);}
    if (type == "variable") {register(value); return cont(functiondef);}
    if (type == "(") return cont(pushcontext, pushlex(")"), commasep(funarg, ")"), poplex, mayberettype, statement, popcontext);
    if (isTS && value == "<") return cont(pushlex(">"), commasep(typeparam, ">"), poplex, functiondef)
  }
  function functiondecl(type, value) {
    if (value == "*") {cx.marked = "keyword"; return cont(functiondecl);}
    if (type == "variable") {register(value); return cont(functiondecl);}
    if (type == "(") return cont(pushcontext, pushlex(")"), commasep(funarg, ")"), poplex, mayberettype, popcontext);
    if (isTS && value == "<") return cont(pushlex(">"), commasep(typeparam, ">"), poplex, functiondecl)
  }
  function typename(type, value) {
    if (type == "keyword" || type == "variable") {
      cx.marked = "type"
      return cont(typename)
    } else if (value == "<") {
      return cont(pushlex(">"), commasep(typeparam, ">"), poplex)
    }
  }
  function funarg(type, value) {
    if (value == "@") cont(expression, funarg)
    if (type == "spread") return cont(funarg);
    if (isTS && isModifier(value)) { cx.marked = "keyword"; return cont(funarg); }
    if (isTS && type == "this") return cont(maybetype, maybeAssign)
    return pass(pattern, maybetype, maybeAssign);
  }
  function classExpression(type, value) {
    // Class expressions may have an optional name.
    if (type == "variable") return className(type, value);
    return classNameAfter(type, value);
  }
  function className(type, value) {
    if (type == "variable") {register(value); return cont(classNameAfter);}
  }
  function classNameAfter(type, value) {
    if (value == "<") return cont(pushlex(">"), commasep(typeparam, ">"), poplex, classNameAfter)
    if (value == "extends" || value == "implements" || (isTS && type == ",")) {
      if (value == "implements") cx.marked = "keyword";
      return cont(isTS ? typeexpr : expression, classNameAfter);
    }
    if (type == "{") return cont(pushlex("}"), classBody, poplex);
  }
  function classBody(type, value) {
    if (type == "async" ||
        (type == "variable" &&
         (value == "static" || value == "get" || value == "set" || (isTS && isModifier(value))) &&
         cx.stream.match(/^\s+[\w$\xa1-\uffff]/, false))) {
      cx.marked = "keyword";
      return cont(classBody);
    }
    if (type == "variable" || cx.style == "keyword") {
      cx.marked = "property";
      return cont(classfield, classBody);
    }
    if (type == "number" || type == "string") return cont(classfield, classBody);
    if (type == "[")
      return cont(expression, maybetype, expect("]"), classfield, classBody)
    if (value == "*") {
      cx.marked = "keyword";
      return cont(classBody);
    }
    if (isTS && type == "(") return pass(functiondecl, classBody)
    if (type == ";" || type == ",") return cont(classBody);
    if (type == "}") return cont();
    if (value == "@") return cont(expression, classBody)
  }
  function classfield(type, value) {
    if (value == "?") return cont(classfield)
    if (type == ":") return cont(typeexpr, maybeAssign)
    if (value == "=") return cont(expressionNoComma)
    var context = cx.state.lexical.prev, isInterface = context && context.info == "interface"
    return pass(isInterface ? functiondecl : functiondef)
  }
  function afterExport(type, value) {
    if (value == "*") { cx.marked = "keyword"; return cont(maybeFrom, expect(";")); }
    if (value == "default") { cx.marked = "keyword"; return cont(expression, expect(";")); }
    if (type == "{") return cont(commasep(exportField, "}"), maybeFrom, expect(";"));
    return pass(statement);
  }
  function exportField(type, value) {
    if (value == "as") { cx.marked = "keyword"; return cont(expect("variable")); }
    if (type == "variable") return pass(expressionNoComma, exportField);
  }
  function afterImport(type) {
    if (type == "string") return cont();
    if (type == "(") return pass(expression);
    return pass(importSpec, maybeMoreImports, maybeFrom);
  }
  function importSpec(type, value) {
    if (type == "{") return contCommasep(importSpec, "}");
    if (type == "variable") register(value);
    if (value == "*") cx.marked = "keyword";
    return cont(maybeAs);
  }
  function maybeMoreImports(type) {
    if (type == ",") return cont(importSpec, maybeMoreImports)
  }
  function maybeAs(_type, value) {
    if (value == "as") { cx.marked = "keyword"; return cont(importSpec); }
  }
  function maybeFrom(_type, value) {
    if (value == "from") { cx.marked = "keyword"; return cont(expression); }
  }
  function arrayLiteral(type) {
    if (type == "]") return cont();
    return pass(commasep(expressionNoComma, "]"));
  }
  function enumdef() {
    return pass(pushlex("form"), pattern, expect("{"), pushlex("}"), commasep(enummember, "}"), poplex, poplex)
  }
  function enummember() {
    return pass(pattern, maybeAssign);
  }

  function isContinuedStatement(state, textAfter) {
    return state.lastType == "operator" || state.lastType == "," ||
      isOperatorChar.test(textAfter.charAt(0)) ||
      /[,.]/.test(textAfter.charAt(0));
  }

  function expressionAllowed(stream, state, backUp) {
    return state.tokenize == tokenBase &&
      /^(?:operator|sof|keyword [bcd]|case|new|export|default|spread|[\[{}\(,;:]|=>)$/.test(state.lastType) ||
      (state.lastType == "quasi" && /\{\s*$/.test(stream.string.slice(0, stream.pos - (backUp || 0))))
  }

  // Interface

  return {
    startState: function(basecolumn) {
      var state = {
        tokenize: tokenBase,
        lastType: "sof",
        cc: [],
        lexical: new JSLexical((basecolumn || 0) - indentUnit, 0, "block", false),
        localVars: parserConfig.localVars,
        context: parserConfig.localVars && new Context(null, null, false),
        indented: basecolumn || 0
      };
      if (parserConfig.globalVars && typeof parserConfig.globalVars == "object")
        state.globalVars = parserConfig.globalVars;
      return state;
    },

    token: function(stream, state) {
      if (stream.sol()) {
        if (!state.lexical.hasOwnProperty("align"))
          state.lexical.align = false;
        state.indented = stream.indentation();
        findFatArrow(stream, state);
      }
      if (state.tokenize != tokenComment && stream.eatSpace()) return null;
      var style = state.tokenize(stream, state);
      if (type == "comment") return style;
      state.lastType = type == "operator" && (content == "++" || content == "--") ? "incdec" : type;
      return parseJS(state, style, type, content, stream);
    },

    indent: function(state, textAfter) {
      if (state.tokenize == tokenComment) return CodeMirror.Pass;
      if (state.tokenize != tokenBase) return 0;
      var firstChar = textAfter && textAfter.charAt(0), lexical = state.lexical, top
      // Kludge to prevent 'maybelse' from blocking lexical scope pops
      if (!/^\s*else\b/.test(textAfter)) for (var i = state.cc.length - 1; i >= 0; --i) {
        var c = state.cc[i];
        if (c == poplex) lexical = lexical.prev;
        else if (c != maybeelse) break;
      }
      while ((lexical.type == "stat" || lexical.type == "form") &&
             (firstChar == "}" || ((top = state.cc[state.cc.length - 1]) &&
                                   (top == maybeoperatorComma || top == maybeoperatorNoComma) &&
                                   !/^[,\.=+\-*:?[\(]/.test(textAfter))))
        lexical = lexical.prev;
      if (statementIndent && lexical.type == ")" && lexical.prev.type == "stat")
        lexical = lexical.prev;
      var type = lexical.type, closing = firstChar == type;

      if (type == "vardef") return lexical.indented + (state.lastType == "operator" || state.lastType == "," ? lexical.info.length + 1 : 0);
      else if (type == "form" && firstChar == "{") return lexical.indented;
      else if (type == "form") return lexical.indented + indentUnit;
      else if (type == "stat")
        return lexical.indented + (isContinuedStatement(state, textAfter) ? statementIndent || indentUnit : 0);
      else if (lexical.info == "switch" && !closing && parserConfig.doubleIndentSwitch != false)
        return lexical.indented + (/^(?:case|default)\b/.test(textAfter) ? indentUnit : 2 * indentUnit);
      else if (lexical.align) return lexical.column + (closing ? 0 : 1);
      else return lexical.indented + (closing ? 0 : indentUnit);
    },

    electricInput: /^\s*(?:case .*?:|default:|\{|\})$/,
    blockCommentStart: jsonMode ? null : "/*",
    blockCommentEnd: jsonMode ? null : "*/",
    blockCommentContinue: jsonMode ? null : " * ",
    lineComment: jsonMode ? null : "//",
    fold: "brace",
    closeBrackets: "()[]{}''\"\"``",

    helperType: jsonMode ? "json" : "javascript",
    jsonldMode: jsonldMode,
    jsonMode: jsonMode,

    expressionAllowed: expressionAllowed,

    skipExpression: function(state) {
      var top = state.cc[state.cc.length - 1]
      if (top == expression || top == expressionNoComma) state.cc.pop()
    }
  };
});

CodeMirror.registerHelper("wordChars", "javascript", /[\w$]/);

CodeMirror.defineMIME("text/javascript", "javascript");
CodeMirror.defineMIME("text/ecmascript", "javascript");
CodeMirror.defineMIME("application/javascript", "javascript");
CodeMirror.defineMIME("application/x-javascript", "javascript");
CodeMirror.defineMIME("application/ecmascript", "javascript");
CodeMirror.defineMIME("application/json", {name: "javascript", json: true});
CodeMirror.defineMIME("application/x-json", {name: "javascript", json: true});
CodeMirror.defineMIME("application/ld+json", {name: "javascript", jsonld: true});
CodeMirror.defineMIME("text/typescript", { name: "javascript", typescript: true });
CodeMirror.defineMIME("application/typescript", { name: "javascript", typescript: true });

});


// CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
      mod(require("../../lib/codemirror"));
    else if (typeof define == "function" && define.amd) // AMD
      define(["../../lib/codemirror"], mod);
    else // Plain browser env
      mod(CodeMirror);
  })(function(CodeMirror) {
  "use strict";
  
  var htmlConfig = {
    autoSelfClosers: {'area': true, 'base': true, 'br': true, 'col': true, 'command': true,
                      'embed': true, 'frame': true, 'hr': true, 'img': true, 'input': true,
                      'keygen': true, 'link': true, 'meta': true, 'param': true, 'source': true,
                      'track': true, 'wbr': true, 'menuitem': true},
    implicitlyClosed: {'dd': true, 'li': true, 'optgroup': true, 'option': true, 'p': true,
                       'rp': true, 'rt': true, 'tbody': true, 'td': true, 'tfoot': true,
                       'th': true, 'tr': true},
    contextGrabbers: {
      'dd': {'dd': true, 'dt': true},
      'dt': {'dd': true, 'dt': true},
      'li': {'li': true},
      'option': {'option': true, 'optgroup': true},
      'optgroup': {'optgroup': true},
      'p': {'address': true, 'article': true, 'aside': true, 'blockquote': true, 'dir': true,
            'div': true, 'dl': true, 'fieldset': true, 'footer': true, 'form': true,
            'h1': true, 'h2': true, 'h3': true, 'h4': true, 'h5': true, 'h6': true,
            'header': true, 'hgroup': true, 'hr': true, 'menu': true, 'nav': true, 'ol': true,
            'p': true, 'pre': true, 'section': true, 'table': true, 'ul': true},
      'rp': {'rp': true, 'rt': true},
      'rt': {'rp': true, 'rt': true},
      'tbody': {'tbody': true, 'tfoot': true},
      'td': {'td': true, 'th': true},
      'tfoot': {'tbody': true},
      'th': {'td': true, 'th': true},
      'thead': {'tbody': true, 'tfoot': true},
      'tr': {'tr': true}
    },
    doNotIndent: {"pre": true},
    allowUnquoted: true,
    allowMissing: true,
    caseFold: true
  }
  
  var xmlConfig = {
    autoSelfClosers: {},
    implicitlyClosed: {},
    contextGrabbers: {},
    doNotIndent: {},
    allowUnquoted: false,
    allowMissing: false,
    allowMissingTagName: false,
    caseFold: false
  }
  
  CodeMirror.defineMode("xml", function(editorConf, config_) {
    var indentUnit = editorConf.indentUnit
    var config = {}
    var defaults = config_.htmlMode ? htmlConfig : xmlConfig
    for (var prop in defaults) config[prop] = defaults[prop]
    for (var prop in config_) config[prop] = config_[prop]
  
    // Return variables for tokenizers
    var type, setStyle;
  
    function inText(stream, state) {
      function chain(parser) {
        state.tokenize = parser;
        return parser(stream, state);
      }
  
      var ch = stream.next();
      if (ch == "<") {
        if (stream.eat("!")) {
          if (stream.eat("[")) {
            if (stream.match("CDATA[")) return chain(inBlock("atom", "]]>"));
            else return null;
          } else if (stream.match("--")) {
            return chain(inBlock("comment", "-->"));
          } else if (stream.match("DOCTYPE", true, true)) {
            stream.eatWhile(/[\w\._\-]/);
            return chain(doctype(1));
          } else {
            return null;
          }
        } else if (stream.eat("?")) {
          stream.eatWhile(/[\w\._\-]/);
          state.tokenize = inBlock("meta", "?>");
          return "meta";
        } else {
          type = stream.eat("/") ? "closeTag" : "openTag";
          state.tokenize = inTag;
          return "tag bracket";
        }
      } else if (ch == "&") {
        var ok;
        if (stream.eat("#")) {
          if (stream.eat("x")) {
            ok = stream.eatWhile(/[a-fA-F\d]/) && stream.eat(";");
          } else {
            ok = stream.eatWhile(/[\d]/) && stream.eat(";");
          }
        } else {
          ok = stream.eatWhile(/[\w\.\-:]/) && stream.eat(";");
        }
        return ok ? "atom" : "error";
      } else {
        stream.eatWhile(/[^&<]/);
        return null;
      }
    }
    inText.isInText = true;
  
    function inTag(stream, state) {
      var ch = stream.next();
      if (ch == ">" || (ch == "/" && stream.eat(">"))) {
        state.tokenize = inText;
        type = ch == ">" ? "endTag" : "selfcloseTag";
        return "tag bracket";
      } else if (ch == "=") {
        type = "equals";
        return null;
      } else if (ch == "<") {
        state.tokenize = inText;
        state.state = baseState;
        state.tagName = state.tagStart = null;
        var next = state.tokenize(stream, state);
        return next ? next + " tag error" : "tag error";
      } else if (/[\'\"]/.test(ch)) {
        state.tokenize = inAttribute(ch);
        state.stringStartCol = stream.column();
        return state.tokenize(stream, state);
      } else {
        stream.match(/^[^\s\u00a0=<>\"\']*[^\s\u00a0=<>\"\'\/]/);
        return "word";
      }
    }
  
    function inAttribute(quote) {
      var closure = function(stream, state) {
        while (!stream.eol()) {
          if (stream.next() == quote) {
            state.tokenize = inTag;
            break;
          }
        }
        return "string";
      };
      closure.isInAttribute = true;
      return closure;
    }
  
    function inBlock(style, terminator) {
      return function(stream, state) {
        while (!stream.eol()) {
          if (stream.match(terminator)) {
            state.tokenize = inText;
            break;
          }
          stream.next();
        }
        return style;
      }
    }
  
    function doctype(depth) {
      return function(stream, state) {
        var ch;
        while ((ch = stream.next()) != null) {
          if (ch == "<") {
            state.tokenize = doctype(depth + 1);
            return state.tokenize(stream, state);
          } else if (ch == ">") {
            if (depth == 1) {
              state.tokenize = inText;
              break;
            } else {
              state.tokenize = doctype(depth - 1);
              return state.tokenize(stream, state);
            }
          }
        }
        return "meta";
      };
    }
  
    function Context(state, tagName, startOfLine) {
      this.prev = state.context;
      this.tagName = tagName;
      this.indent = state.indented;
      this.startOfLine = startOfLine;
      if (config.doNotIndent.hasOwnProperty(tagName) || (state.context && state.context.noIndent))
        this.noIndent = true;
    }
    function popContext(state) {
      if (state.context) state.context = state.context.prev;
    }
    function maybePopContext(state, nextTagName) {
      var parentTagName;
      while (true) {
        if (!state.context) {
          return;
        }
        parentTagName = state.context.tagName;
        if (!config.contextGrabbers.hasOwnProperty(parentTagName) ||
            !config.contextGrabbers[parentTagName].hasOwnProperty(nextTagName)) {
          return;
        }
        popContext(state);
      }
    }
  
    function baseState(type, stream, state) {
      if (type == "openTag") {
        state.tagStart = stream.column();
        return tagNameState;
      } else if (type == "closeTag") {
        return closeTagNameState;
      } else {
        return baseState;
      }
    }
    function tagNameState(type, stream, state) {
      if (type == "word") {
        state.tagName = stream.current();
        setStyle = "tag";
        return attrState;
      } else if (config.allowMissingTagName && type == "endTag") {
        setStyle = "tag bracket";
        return attrState(type, stream, state);
      } else {
        setStyle = "error";
        return tagNameState;
      }
    }
    function closeTagNameState(type, stream, state) {
      if (type == "word") {
        var tagName = stream.current();
        if (state.context && state.context.tagName != tagName &&
            config.implicitlyClosed.hasOwnProperty(state.context.tagName))
          popContext(state);
        if ((state.context && state.context.tagName == tagName) || config.matchClosing === false) {
          setStyle = "tag";
          return closeState;
        } else {
          setStyle = "tag error";
          return closeStateErr;
        }
      } else if (config.allowMissingTagName && type == "endTag") {
        setStyle = "tag bracket";
        return closeState(type, stream, state);
      } else {
        setStyle = "error";
        return closeStateErr;
      }
    }
  
    function closeState(type, _stream, state) {
      if (type != "endTag") {
        setStyle = "error";
        return closeState;
      }
      popContext(state);
      return baseState;
    }
    function closeStateErr(type, stream, state) {
      setStyle = "error";
      return closeState(type, stream, state);
    }
  
    function attrState(type, _stream, state) {
      if (type == "word") {
        setStyle = "attribute";
        return attrEqState;
      } else if (type == "endTag" || type == "selfcloseTag") {
        var tagName = state.tagName, tagStart = state.tagStart;
        state.tagName = state.tagStart = null;
        if (type == "selfcloseTag" ||
            config.autoSelfClosers.hasOwnProperty(tagName)) {
          maybePopContext(state, tagName);
        } else {
          maybePopContext(state, tagName);
          state.context = new Context(state, tagName, tagStart == state.indented);
        }
        return baseState;
      }
      setStyle = "error";
      return attrState;
    }
    function attrEqState(type, stream, state) {
      if (type == "equals") return attrValueState;
      if (!config.allowMissing) setStyle = "error";
      return attrState(type, stream, state);
    }
    function attrValueState(type, stream, state) {
      if (type == "string") return attrContinuedState;
      if (type == "word" && config.allowUnquoted) {setStyle = "string"; return attrState;}
      setStyle = "error";
      return attrState(type, stream, state);
    }
    function attrContinuedState(type, stream, state) {
      if (type == "string") return attrContinuedState;
      return attrState(type, stream, state);
    }
  
    return {
      startState: function(baseIndent) {
        var state = {tokenize: inText,
                     state: baseState,
                     indented: baseIndent || 0,
                     tagName: null, tagStart: null,
                     context: null}
        if (baseIndent != null) state.baseIndent = baseIndent
        return state
      },
  
      token: function(stream, state) {
        if (!state.tagName && stream.sol())
          state.indented = stream.indentation();
  
        if (stream.eatSpace()) return null;
        type = null;
        var style = state.tokenize(stream, state);
        if ((style || type) && style != "comment") {
          setStyle = null;
          state.state = state.state(type || style, stream, state);
          if (setStyle)
            style = setStyle == "error" ? style + " error" : setStyle;
        }
        return style;
      },
  
      indent: function(state, textAfter, fullLine) {
        var context = state.context;
        // Indent multi-line strings (e.g. css).
        if (state.tokenize.isInAttribute) {
          if (state.tagStart == state.indented)
            return state.stringStartCol + 1;
          else
            return state.indented + indentUnit;
        }
        if (context && context.noIndent) return CodeMirror.Pass;
        if (state.tokenize != inTag && state.tokenize != inText)
          return fullLine ? fullLine.match(/^(\s*)/)[0].length : 0;
        // Indent the starts of attribute names.
        if (state.tagName) {
          if (config.multilineTagIndentPastTag !== false)
            return state.tagStart + state.tagName.length + 2;
          else
            return state.tagStart + indentUnit * (config.multilineTagIndentFactor || 1);
        }
        if (config.alignCDATA && /<!\[CDATA\[/.test(textAfter)) return 0;
        var tagAfter = textAfter && /^<(\/)?([\w_:\.-]*)/.exec(textAfter);
        if (tagAfter && tagAfter[1]) { // Closing tag spotted
          while (context) {
            if (context.tagName == tagAfter[2]) {
              context = context.prev;
              break;
            } else if (config.implicitlyClosed.hasOwnProperty(context.tagName)) {
              context = context.prev;
            } else {
              break;
            }
          }
        } else if (tagAfter) { // Opening tag spotted
          while (context) {
            var grabbers = config.contextGrabbers[context.tagName];
            if (grabbers && grabbers.hasOwnProperty(tagAfter[2]))
              context = context.prev;
            else
              break;
          }
        }
        while (context && context.prev && !context.startOfLine)
          context = context.prev;
        if (context) return context.indent + indentUnit;
        else return state.baseIndent || 0;
      },
  
      electricInput: /<\/[\s\w:]+>$/,
      blockCommentStart: "<!--",
      blockCommentEnd: "-->",
  
      configuration: config.htmlMode ? "html" : "xml",
      helperType: config.htmlMode ? "html" : "xml",
  
      skipAttribute: function(state) {
        if (state.state == attrValueState)
          state.state = attrState
      },
  
      xmlCurrentTag: function(state) {
        return state.tagName ? {name: state.tagName, close: state.type == "closeTag"} : null
      },
  
      xmlCurrentContext: function(state) {
        var context = []
        for (var cx = state.context; cx; cx = cx.prev)
          if (cx.tagName) context.push(cx.tagName)
        return context.reverse()
      }
    };
  });
  
  CodeMirror.defineMIME("text/xml", "xml");
  CodeMirror.defineMIME("application/xml", "xml");
  if (!CodeMirror.mimeModes.hasOwnProperty("text/html"))
    CodeMirror.defineMIME("text/html", {name: "xml", htmlMode: true});
  
  });



  // CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
      mod(require("../../lib/codemirror"));
    else if (typeof define == "function" && define.amd) // AMD
      define(["../../lib/codemirror"], mod);
    else // Plain browser env
      mod(CodeMirror);
  })(function(CodeMirror) {
  "use strict";
  
  CodeMirror.defineMode("css", function(config, parserConfig) {
    var inline = parserConfig.inline
    if (!parserConfig.propertyKeywords) parserConfig = CodeMirror.resolveMode("text/css");
  
    var indentUnit = config.indentUnit,
        tokenHooks = parserConfig.tokenHooks,
        documentTypes = parserConfig.documentTypes || {},
        mediaTypes = parserConfig.mediaTypes || {},
        mediaFeatures = parserConfig.mediaFeatures || {},
        mediaValueKeywords = parserConfig.mediaValueKeywords || {},
        propertyKeywords = parserConfig.propertyKeywords || {},
        nonStandardPropertyKeywords = parserConfig.nonStandardPropertyKeywords || {},
        fontProperties = parserConfig.fontProperties || {},
        counterDescriptors = parserConfig.counterDescriptors || {},
        colorKeywords = parserConfig.colorKeywords || {},
        valueKeywords = parserConfig.valueKeywords || {},
        allowNested = parserConfig.allowNested,
        lineComment = parserConfig.lineComment,
        supportsAtComponent = parserConfig.supportsAtComponent === true;
  
    var type, override;
    function ret(style, tp) { type = tp; return style; }
  
    // Tokenizers
  
    function tokenBase(stream, state) {
      var ch = stream.next();
      if (tokenHooks[ch]) {
        var result = tokenHooks[ch](stream, state);
        if (result !== false) return result;
      }
      if (ch == "@") {
        stream.eatWhile(/[\w\\\-]/);
        return ret("def", stream.current());
      } else if (ch == "=" || (ch == "~" || ch == "|") && stream.eat("=")) {
        return ret(null, "compare");
      } else if (ch == "\"" || ch == "'") {
        state.tokenize = tokenString(ch);
        return state.tokenize(stream, state);
      } else if (ch == "#") {
        stream.eatWhile(/[\w\\\-]/);
        return ret("atom", "hash");
      } else if (ch == "!") {
        stream.match(/^\s*\w*/);
        return ret("keyword", "important");
      } else if (/\d/.test(ch) || ch == "." && stream.eat(/\d/)) {
        stream.eatWhile(/[\w.%]/);
        return ret("number", "unit");
      } else if (ch === "-") {
        if (/[\d.]/.test(stream.peek())) {
          stream.eatWhile(/[\w.%]/);
          return ret("number", "unit");
        } else if (stream.match(/^-[\w\\\-]*/)) {
          stream.eatWhile(/[\w\\\-]/);
          if (stream.match(/^\s*:/, false))
            return ret("variable-2", "variable-definition");
          return ret("variable-2", "variable");
        } else if (stream.match(/^\w+-/)) {
          return ret("meta", "meta");
        }
      } else if (/[,+>*\/]/.test(ch)) {
        return ret(null, "select-op");
      } else if (ch == "." && stream.match(/^-?[_a-z][_a-z0-9-]*/i)) {
        return ret("qualifier", "qualifier");
      } else if (/[:;{}\[\]\(\)]/.test(ch)) {
        return ret(null, ch);
      } else if (stream.match(/[\w-.]+(?=\()/)) {
        if (/^(url(-prefix)?|domain|regexp)$/.test(stream.current().toLowerCase())) {
          state.tokenize = tokenParenthesized;
        }
        return ret("variable callee", "variable");
      } else if (/[\w\\\-]/.test(ch)) {
        stream.eatWhile(/[\w\\\-]/);
        return ret("property", "word");
      } else {
        return ret(null, null);
      }
    }
  
    function tokenString(quote) {
      return function(stream, state) {
        var escaped = false, ch;
        while ((ch = stream.next()) != null) {
          if (ch == quote && !escaped) {
            if (quote == ")") stream.backUp(1);
            break;
          }
          escaped = !escaped && ch == "\\";
        }
        if (ch == quote || !escaped && quote != ")") state.tokenize = null;
        return ret("string", "string");
      };
    }
  
    function tokenParenthesized(stream, state) {
      stream.next(); // Must be '('
      if (!stream.match(/\s*[\"\')]/, false))
        state.tokenize = tokenString(")");
      else
        state.tokenize = null;
      return ret(null, "(");
    }
  
    // Context management
  
    function Context(type, indent, prev) {
      this.type = type;
      this.indent = indent;
      this.prev = prev;
    }
  
    function pushContext(state, stream, type, indent) {
      state.context = new Context(type, stream.indentation() + (indent === false ? 0 : indentUnit), state.context);
      return type;
    }
  
    function popContext(state) {
      if (state.context.prev)
        state.context = state.context.prev;
      return state.context.type;
    }
  
    function pass(type, stream, state) {
      return states[state.context.type](type, stream, state);
    }
    function popAndPass(type, stream, state, n) {
      for (var i = n || 1; i > 0; i--)
        state.context = state.context.prev;
      return pass(type, stream, state);
    }
  
    // Parser
  
    function wordAsValue(stream) {
      var word = stream.current().toLowerCase();
      if (valueKeywords.hasOwnProperty(word))
        override = "atom";
      else if (colorKeywords.hasOwnProperty(word))
        override = "keyword";
      else
        override = "variable";
    }
  
    var states = {};
  
    states.top = function(type, stream, state) {
      if (type == "{") {
        return pushContext(state, stream, "block");
      } else if (type == "}" && state.context.prev) {
        return popContext(state);
      } else if (supportsAtComponent && /@component/i.test(type)) {
        return pushContext(state, stream, "atComponentBlock");
      } else if (/^@(-moz-)?document$/i.test(type)) {
        return pushContext(state, stream, "documentTypes");
      } else if (/^@(media|supports|(-moz-)?document|import)$/i.test(type)) {
        return pushContext(state, stream, "atBlock");
      } else if (/^@(font-face|counter-style)/i.test(type)) {
        state.stateArg = type;
        return "restricted_atBlock_before";
      } else if (/^@(-(moz|ms|o|webkit)-)?keyframes$/i.test(type)) {
        return "keyframes";
      } else if (type && type.charAt(0) == "@") {
        return pushContext(state, stream, "at");
      } else if (type == "hash") {
        override = "builtin";
      } else if (type == "word") {
        override = "tag";
      } else if (type == "variable-definition") {
        return "maybeprop";
      } else if (type == "interpolation") {
        return pushContext(state, stream, "interpolation");
      } else if (type == ":") {
        return "pseudo";
      } else if (allowNested && type == "(") {
        return pushContext(state, stream, "parens");
      }
      return state.context.type;
    };
  
    states.block = function(type, stream, state) {
      if (type == "word") {
        var word = stream.current().toLowerCase();
        if (propertyKeywords.hasOwnProperty(word)) {
          override = "property";
          return "maybeprop";
        } else if (nonStandardPropertyKeywords.hasOwnProperty(word)) {
          override = "string-2";
          return "maybeprop";
        } else if (allowNested) {
          override = stream.match(/^\s*:(?:\s|$)/, false) ? "property" : "tag";
          return "block";
        } else {
          override += " error";
          return "maybeprop";
        }
      } else if (type == "meta") {
        return "block";
      } else if (!allowNested && (type == "hash" || type == "qualifier")) {
        override = "error";
        return "block";
      } else {
        return states.top(type, stream, state);
      }
    };
  
    states.maybeprop = function(type, stream, state) {
      if (type == ":") return pushContext(state, stream, "prop");
      return pass(type, stream, state);
    };
  
    states.prop = function(type, stream, state) {
      if (type == ";") return popContext(state);
      if (type == "{" && allowNested) return pushContext(state, stream, "propBlock");
      if (type == "}" || type == "{") return popAndPass(type, stream, state);
      if (type == "(") return pushContext(state, stream, "parens");
  
      if (type == "hash" && !/^#([0-9a-fA-f]{3,4}|[0-9a-fA-f]{6}|[0-9a-fA-f]{8})$/.test(stream.current())) {
        override += " error";
      } else if (type == "word") {
        wordAsValue(stream);
      } else if (type == "interpolation") {
        return pushContext(state, stream, "interpolation");
      }
      return "prop";
    };
  
    states.propBlock = function(type, _stream, state) {
      if (type == "}") return popContext(state);
      if (type == "word") { override = "property"; return "maybeprop"; }
      return state.context.type;
    };
  
    states.parens = function(type, stream, state) {
      if (type == "{" || type == "}") return popAndPass(type, stream, state);
      if (type == ")") return popContext(state);
      if (type == "(") return pushContext(state, stream, "parens");
      if (type == "interpolation") return pushContext(state, stream, "interpolation");
      if (type == "word") wordAsValue(stream);
      return "parens";
    };
  
    states.pseudo = function(type, stream, state) {
      if (type == "meta") return "pseudo";
  
      if (type == "word") {
        override = "variable-3";
        return state.context.type;
      }
      return pass(type, stream, state);
    };
  
    states.documentTypes = function(type, stream, state) {
      if (type == "word" && documentTypes.hasOwnProperty(stream.current())) {
        override = "tag";
        return state.context.type;
      } else {
        return states.atBlock(type, stream, state);
      }
    };
  
    states.atBlock = function(type, stream, state) {
      if (type == "(") return pushContext(state, stream, "atBlock_parens");
      if (type == "}" || type == ";") return popAndPass(type, stream, state);
      if (type == "{") return popContext(state) && pushContext(state, stream, allowNested ? "block" : "top");
  
      if (type == "interpolation") return pushContext(state, stream, "interpolation");
  
      if (type == "word") {
        var word = stream.current().toLowerCase();
        if (word == "only" || word == "not" || word == "and" || word == "or")
          override = "keyword";
        else if (mediaTypes.hasOwnProperty(word))
          override = "attribute";
        else if (mediaFeatures.hasOwnProperty(word))
          override = "property";
        else if (mediaValueKeywords.hasOwnProperty(word))
          override = "keyword";
        else if (propertyKeywords.hasOwnProperty(word))
          override = "property";
        else if (nonStandardPropertyKeywords.hasOwnProperty(word))
          override = "string-2";
        else if (valueKeywords.hasOwnProperty(word))
          override = "atom";
        else if (colorKeywords.hasOwnProperty(word))
          override = "keyword";
        else
          override = "error";
      }
      return state.context.type;
    };
  
    states.atComponentBlock = function(type, stream, state) {
      if (type == "}")
        return popAndPass(type, stream, state);
      if (type == "{")
        return popContext(state) && pushContext(state, stream, allowNested ? "block" : "top", false);
      if (type == "word")
        override = "error";
      return state.context.type;
    };
  
    states.atBlock_parens = function(type, stream, state) {
      if (type == ")") return popContext(state);
      if (type == "{" || type == "}") return popAndPass(type, stream, state, 2);
      return states.atBlock(type, stream, state);
    };
  
    states.restricted_atBlock_before = function(type, stream, state) {
      if (type == "{")
        return pushContext(state, stream, "restricted_atBlock");
      if (type == "word" && state.stateArg == "@counter-style") {
        override = "variable";
        return "restricted_atBlock_before";
      }
      return pass(type, stream, state);
    };
  
    states.restricted_atBlock = function(type, stream, state) {
      if (type == "}") {
        state.stateArg = null;
        return popContext(state);
      }
      if (type == "word") {
        if ((state.stateArg == "@font-face" && !fontProperties.hasOwnProperty(stream.current().toLowerCase())) ||
            (state.stateArg == "@counter-style" && !counterDescriptors.hasOwnProperty(stream.current().toLowerCase())))
          override = "error";
        else
          override = "property";
        return "maybeprop";
      }
      return "restricted_atBlock";
    };
  
    states.keyframes = function(type, stream, state) {
      if (type == "word") { override = "variable"; return "keyframes"; }
      if (type == "{") return pushContext(state, stream, "top");
      return pass(type, stream, state);
    };
  
    states.at = function(type, stream, state) {
      if (type == ";") return popContext(state);
      if (type == "{" || type == "}") return popAndPass(type, stream, state);
      if (type == "word") override = "tag";
      else if (type == "hash") override = "builtin";
      return "at";
    };
  
    states.interpolation = function(type, stream, state) {
      if (type == "}") return popContext(state);
      if (type == "{" || type == ";") return popAndPass(type, stream, state);
      if (type == "word") override = "variable";
      else if (type != "variable" && type != "(" && type != ")") override = "error";
      return "interpolation";
    };
  
    return {
      startState: function(base) {
        return {tokenize: null,
                state: inline ? "block" : "top",
                stateArg: null,
                context: new Context(inline ? "block" : "top", base || 0, null)};
      },
  
      token: function(stream, state) {
        if (!state.tokenize && stream.eatSpace()) return null;
        var style = (state.tokenize || tokenBase)(stream, state);
        if (style && typeof style == "object") {
          type = style[1];
          style = style[0];
        }
        override = style;
        if (type != "comment")
          state.state = states[state.state](type, stream, state);
        return override;
      },
  
      indent: function(state, textAfter) {
        var cx = state.context, ch = textAfter && textAfter.charAt(0);
        var indent = cx.indent;
        if (cx.type == "prop" && (ch == "}" || ch == ")")) cx = cx.prev;
        if (cx.prev) {
          if (ch == "}" && (cx.type == "block" || cx.type == "top" ||
                            cx.type == "interpolation" || cx.type == "restricted_atBlock")) {
            // Resume indentation from parent context.
            cx = cx.prev;
            indent = cx.indent;
          } else if (ch == ")" && (cx.type == "parens" || cx.type == "atBlock_parens") ||
              ch == "{" && (cx.type == "at" || cx.type == "atBlock")) {
            // Dedent relative to current context.
            indent = Math.max(0, cx.indent - indentUnit);
          }
        }
        return indent;
      },
  
      electricChars: "}",
      blockCommentStart: "/*",
      blockCommentEnd: "*/",
      blockCommentContinue: " * ",
      lineComment: lineComment,
      fold: "brace"
    };
  });
  
    function keySet(array) {
      var keys = {};
      for (var i = 0; i < array.length; ++i) {
        keys[array[i].toLowerCase()] = true;
      }
      return keys;
    }
  
    var documentTypes_ = [
      "domain", "regexp", "url", "url-prefix"
    ], documentTypes = keySet(documentTypes_);
  
    var mediaTypes_ = [
      "all", "aural", "braille", "handheld", "print", "projection", "screen",
      "tty", "tv", "embossed"
    ], mediaTypes = keySet(mediaTypes_);
  
    var mediaFeatures_ = [
      "width", "min-width", "max-width", "height", "min-height", "max-height",
      "device-width", "min-device-width", "max-device-width", "device-height",
      "min-device-height", "max-device-height", "aspect-ratio",
      "min-aspect-ratio", "max-aspect-ratio", "device-aspect-ratio",
      "min-device-aspect-ratio", "max-device-aspect-ratio", "color", "min-color",
      "max-color", "color-index", "min-color-index", "max-color-index",
      "monochrome", "min-monochrome", "max-monochrome", "resolution",
      "min-resolution", "max-resolution", "scan", "grid", "orientation",
      "device-pixel-ratio", "min-device-pixel-ratio", "max-device-pixel-ratio",
      "pointer", "any-pointer", "hover", "any-hover"
    ], mediaFeatures = keySet(mediaFeatures_);
  
    var mediaValueKeywords_ = [
      "landscape", "portrait", "none", "coarse", "fine", "on-demand", "hover",
      "interlace", "progressive"
    ], mediaValueKeywords = keySet(mediaValueKeywords_);
  
    var propertyKeywords_ = [
      "align-content", "align-items", "align-self", "alignment-adjust",
      "alignment-baseline", "anchor-point", "animation", "animation-delay",
      "animation-direction", "animation-duration", "animation-fill-mode",
      "animation-iteration-count", "animation-name", "animation-play-state",
      "animation-timing-function", "appearance", "azimuth", "backdrop-filter",
      "backface-visibility", "background", "background-attachment",
      "background-blend-mode", "background-clip", "background-color",
      "background-image", "background-origin", "background-position",
      "background-position-x", "background-position-y", "background-repeat",
      "background-size", "baseline-shift", "binding", "bleed", "block-size",
      "bookmark-label", "bookmark-level", "bookmark-state", "bookmark-target",
      "border", "border-bottom", "border-bottom-color", "border-bottom-left-radius",
      "border-bottom-right-radius", "border-bottom-style", "border-bottom-width",
      "border-collapse", "border-color", "border-image", "border-image-outset",
      "border-image-repeat", "border-image-slice", "border-image-source",
      "border-image-width", "border-left", "border-left-color", "border-left-style",
      "border-left-width", "border-radius", "border-right", "border-right-color",
      "border-right-style", "border-right-width", "border-spacing", "border-style",
      "border-top", "border-top-color", "border-top-left-radius",
      "border-top-right-radius", "border-top-style", "border-top-width",
      "border-width", "bottom", "box-decoration-break", "box-shadow", "box-sizing",
      "break-after", "break-before", "break-inside", "caption-side", "caret-color",
      "clear", "clip", "color", "color-profile", "column-count", "column-fill",
      "column-gap", "column-rule", "column-rule-color", "column-rule-style",
      "column-rule-width", "column-span", "column-width", "columns", "contain",
      "content", "counter-increment", "counter-reset", "crop", "cue", "cue-after",
      "cue-before", "cursor", "direction", "display", "dominant-baseline",
      "drop-initial-after-adjust", "drop-initial-after-align",
      "drop-initial-before-adjust", "drop-initial-before-align", "drop-initial-size",
      "drop-initial-value", "elevation", "empty-cells", "fit", "fit-position",
      "flex", "flex-basis", "flex-direction", "flex-flow", "flex-grow",
      "flex-shrink", "flex-wrap", "float", "float-offset", "flow-from", "flow-into",
      "font", "font-family", "font-feature-settings", "font-kerning",
      "font-language-override", "font-optical-sizing", "font-size",
      "font-size-adjust", "font-stretch", "font-style", "font-synthesis",
      "font-variant", "font-variant-alternates", "font-variant-caps",
      "font-variant-east-asian", "font-variant-ligatures", "font-variant-numeric",
      "font-variant-position", "font-variation-settings", "font-weight", "gap",
      "grid", "grid-area", "grid-auto-columns", "grid-auto-flow", "grid-auto-rows",
      "grid-column", "grid-column-end", "grid-column-gap", "grid-column-start",
      "grid-gap", "grid-row", "grid-row-end", "grid-row-gap", "grid-row-start",
      "grid-template", "grid-template-areas", "grid-template-columns",
      "grid-template-rows", "hanging-punctuation", "height", "hyphens", "icon",
      "image-orientation", "image-rendering", "image-resolution", "inline-box-align",
      "inset", "inset-block", "inset-block-end", "inset-block-start", "inset-inline",
      "inset-inline-end", "inset-inline-start", "isolation", "justify-content",
      "justify-items", "justify-self", "left", "letter-spacing", "line-break",
      "line-height", "line-height-step", "line-stacking", "line-stacking-ruby",
      "line-stacking-shift", "line-stacking-strategy", "list-style",
      "list-style-image", "list-style-position", "list-style-type", "margin",
      "margin-bottom", "margin-left", "margin-right", "margin-top", "marks",
      "marquee-direction", "marquee-loop", "marquee-play-count", "marquee-speed",
      "marquee-style", "max-block-size", "max-height", "max-inline-size",
      "max-width", "min-block-size", "min-height", "min-inline-size", "min-width",
      "mix-blend-mode", "move-to", "nav-down", "nav-index", "nav-left", "nav-right",
      "nav-up", "object-fit", "object-position", "offset", "offset-anchor",
      "offset-distance", "offset-path", "offset-position", "offset-rotate",
      "opacity", "order", "orphans", "outline", "outline-color", "outline-offset",
      "outline-style", "outline-width", "overflow", "overflow-style",
      "overflow-wrap", "overflow-x", "overflow-y", "padding", "padding-bottom",
      "padding-left", "padding-right", "padding-top", "page", "page-break-after",
      "page-break-before", "page-break-inside", "page-policy", "pause",
      "pause-after", "pause-before", "perspective", "perspective-origin", "pitch",
      "pitch-range", "place-content", "place-items", "place-self", "play-during",
      "position", "presentation-level", "punctuation-trim", "quotes",
      "region-break-after", "region-break-before", "region-break-inside",
      "region-fragment", "rendering-intent", "resize", "rest", "rest-after",
      "rest-before", "richness", "right", "rotate", "rotation", "rotation-point",
      "row-gap", "ruby-align", "ruby-overhang", "ruby-position", "ruby-span",
      "scale", "scroll-behavior", "scroll-margin", "scroll-margin-block",
      "scroll-margin-block-end", "scroll-margin-block-start", "scroll-margin-bottom",
      "scroll-margin-inline", "scroll-margin-inline-end",
      "scroll-margin-inline-start", "scroll-margin-left", "scroll-margin-right",
      "scroll-margin-top", "scroll-padding", "scroll-padding-block",
      "scroll-padding-block-end", "scroll-padding-block-start",
      "scroll-padding-bottom", "scroll-padding-inline", "scroll-padding-inline-end",
      "scroll-padding-inline-start", "scroll-padding-left", "scroll-padding-right",
      "scroll-padding-top", "scroll-snap-align", "scroll-snap-type",
      "shape-image-threshold", "shape-inside", "shape-margin", "shape-outside",
      "size", "speak", "speak-as", "speak-header", "speak-numeral",
      "speak-punctuation", "speech-rate", "stress", "string-set", "tab-size",
      "table-layout", "target", "target-name", "target-new", "target-position",
      "text-align", "text-align-last", "text-combine-upright", "text-decoration",
      "text-decoration-color", "text-decoration-line", "text-decoration-skip",
      "text-decoration-skip-ink", "text-decoration-style", "text-emphasis",
      "text-emphasis-color", "text-emphasis-position", "text-emphasis-style",
      "text-height", "text-indent", "text-justify", "text-orientation",
      "text-outline", "text-overflow", "text-rendering", "text-shadow",
      "text-size-adjust", "text-space-collapse", "text-transform",
      "text-underline-position", "text-wrap", "top", "transform", "transform-origin",
      "transform-style", "transition", "transition-delay", "transition-duration",
      "transition-property", "transition-timing-function", "translate",
      "unicode-bidi", "user-select", "vertical-align", "visibility", "voice-balance",
      "voice-duration", "voice-family", "voice-pitch", "voice-range", "voice-rate",
      "voice-stress", "voice-volume", "volume", "white-space", "widows", "width",
      "will-change", "word-break", "word-spacing", "word-wrap", "writing-mode", "z-index",
      // SVG-specific
      "clip-path", "clip-rule", "mask", "enable-background", "filter", "flood-color",
      "flood-opacity", "lighting-color", "stop-color", "stop-opacity", "pointer-events",
      "color-interpolation", "color-interpolation-filters",
      "color-rendering", "fill", "fill-opacity", "fill-rule", "image-rendering",
      "marker", "marker-end", "marker-mid", "marker-start", "shape-rendering", "stroke",
      "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin",
      "stroke-miterlimit", "stroke-opacity", "stroke-width", "text-rendering",
      "baseline-shift", "dominant-baseline", "glyph-orientation-horizontal",
      "glyph-orientation-vertical", "text-anchor", "writing-mode"
    ], propertyKeywords = keySet(propertyKeywords_);
  
    var nonStandardPropertyKeywords_ = [
      "border-block", "border-block-color", "border-block-end",
      "border-block-end-color", "border-block-end-style", "border-block-end-width",
      "border-block-start", "border-block-start-color", "border-block-start-style",
      "border-block-start-width", "border-block-style", "border-block-width",
      "border-inline", "border-inline-color", "border-inline-end",
      "border-inline-end-color", "border-inline-end-style",
      "border-inline-end-width", "border-inline-start", "border-inline-start-color",
      "border-inline-start-style", "border-inline-start-width",
      "border-inline-style", "border-inline-width", "margin-block",
      "margin-block-end", "margin-block-start", "margin-inline", "margin-inline-end",
      "margin-inline-start", "padding-block", "padding-block-end",
      "padding-block-start", "padding-inline", "padding-inline-end",
      "padding-inline-start", "scroll-snap-stop", "scrollbar-3d-light-color",
      "scrollbar-arrow-color", "scrollbar-base-color", "scrollbar-dark-shadow-color",
      "scrollbar-face-color", "scrollbar-highlight-color", "scrollbar-shadow-color",
      "scrollbar-track-color", "searchfield-cancel-button", "searchfield-decoration",
      "searchfield-results-button", "searchfield-results-decoration", "shape-inside", "zoom"
    ], nonStandardPropertyKeywords = keySet(nonStandardPropertyKeywords_);
  
    var fontProperties_ = [
      "font-display", "font-family", "src", "unicode-range", "font-variant",
       "font-feature-settings", "font-stretch", "font-weight", "font-style"
    ], fontProperties = keySet(fontProperties_);
  
    var counterDescriptors_ = [
      "additive-symbols", "fallback", "negative", "pad", "prefix", "range",
      "speak-as", "suffix", "symbols", "system"
    ], counterDescriptors = keySet(counterDescriptors_);
  
    var colorKeywords_ = [
      "aliceblue", "antiquewhite", "aqua", "aquamarine", "azure", "beige",
      "bisque", "black", "blanchedalmond", "blue", "blueviolet", "brown",
      "burlywood", "cadetblue", "chartreuse", "chocolate", "coral", "cornflowerblue",
      "cornsilk", "crimson", "cyan", "darkblue", "darkcyan", "darkgoldenrod",
      "darkgray", "darkgreen", "darkkhaki", "darkmagenta", "darkolivegreen",
      "darkorange", "darkorchid", "darkred", "darksalmon", "darkseagreen",
      "darkslateblue", "darkslategray", "darkturquoise", "darkviolet",
      "deeppink", "deepskyblue", "dimgray", "dodgerblue", "firebrick",
      "floralwhite", "forestgreen", "fuchsia", "gainsboro", "ghostwhite",
      "gold", "goldenrod", "gray", "grey", "green", "greenyellow", "honeydew",
      "hotpink", "indianred", "indigo", "ivory", "khaki", "lavender",
      "lavenderblush", "lawngreen", "lemonchiffon", "lightblue", "lightcoral",
      "lightcyan", "lightgoldenrodyellow", "lightgray", "lightgreen", "lightpink",
      "lightsalmon", "lightseagreen", "lightskyblue", "lightslategray",
      "lightsteelblue", "lightyellow", "lime", "limegreen", "linen", "magenta",
      "maroon", "mediumaquamarine", "mediumblue", "mediumorchid", "mediumpurple",
      "mediumseagreen", "mediumslateblue", "mediumspringgreen", "mediumturquoise",
      "mediumvioletred", "midnightblue", "mintcream", "mistyrose", "moccasin",
      "navajowhite", "navy", "oldlace", "olive", "olivedrab", "orange", "orangered",
      "orchid", "palegoldenrod", "palegreen", "paleturquoise", "palevioletred",
      "papayawhip", "peachpuff", "peru", "pink", "plum", "powderblue",
      "purple", "rebeccapurple", "red", "rosybrown", "royalblue", "saddlebrown",
      "salmon", "sandybrown", "seagreen", "seashell", "sienna", "silver", "skyblue",
      "slateblue", "slategray", "snow", "springgreen", "steelblue", "tan",
      "teal", "thistle", "tomato", "turquoise", "violet", "wheat", "white",
      "whitesmoke", "yellow", "yellowgreen"
    ], colorKeywords = keySet(colorKeywords_);
  
    var valueKeywords_ = [
      "above", "absolute", "activeborder", "additive", "activecaption", "afar",
      "after-white-space", "ahead", "alias", "all", "all-scroll", "alphabetic", "alternate",
      "always", "amharic", "amharic-abegede", "antialiased", "appworkspace",
      "arabic-indic", "armenian", "asterisks", "attr", "auto", "auto-flow", "avoid", "avoid-column", "avoid-page",
      "avoid-region", "background", "backwards", "baseline", "below", "bidi-override", "binary",
      "bengali", "blink", "block", "block-axis", "bold", "bolder", "border", "border-box",
      "both", "bottom", "break", "break-all", "break-word", "bullets", "button", "button-bevel",
      "buttonface", "buttonhighlight", "buttonshadow", "buttontext", "calc", "cambodian",
      "capitalize", "caps-lock-indicator", "caption", "captiontext", "caret",
      "cell", "center", "checkbox", "circle", "cjk-decimal", "cjk-earthly-branch",
      "cjk-heavenly-stem", "cjk-ideographic", "clear", "clip", "close-quote",
      "col-resize", "collapse", "color", "color-burn", "color-dodge", "column", "column-reverse",
      "compact", "condensed", "contain", "content", "contents",
      "content-box", "context-menu", "continuous", "copy", "counter", "counters", "cover", "crop",
      "cross", "crosshair", "currentcolor", "cursive", "cyclic", "darken", "dashed", "decimal",
      "decimal-leading-zero", "default", "default-button", "dense", "destination-atop",
      "destination-in", "destination-out", "destination-over", "devanagari", "difference",
      "disc", "discard", "disclosure-closed", "disclosure-open", "document",
      "dot-dash", "dot-dot-dash",
      "dotted", "double", "down", "e-resize", "ease", "ease-in", "ease-in-out", "ease-out",
      "element", "ellipse", "ellipsis", "embed", "end", "ethiopic", "ethiopic-abegede",
      "ethiopic-abegede-am-et", "ethiopic-abegede-gez", "ethiopic-abegede-ti-er",
      "ethiopic-abegede-ti-et", "ethiopic-halehame-aa-er",
      "ethiopic-halehame-aa-et", "ethiopic-halehame-am-et",
      "ethiopic-halehame-gez", "ethiopic-halehame-om-et",
      "ethiopic-halehame-sid-et", "ethiopic-halehame-so-et",
      "ethiopic-halehame-ti-er", "ethiopic-halehame-ti-et", "ethiopic-halehame-tig",
      "ethiopic-numeric", "ew-resize", "exclusion", "expanded", "extends", "extra-condensed",
      "extra-expanded", "fantasy", "fast", "fill", "fixed", "flat", "flex", "flex-end", "flex-start", "footnotes",
      "forwards", "from", "geometricPrecision", "georgian", "graytext", "grid", "groove",
      "gujarati", "gurmukhi", "hand", "hangul", "hangul-consonant", "hard-light", "hebrew",
      "help", "hidden", "hide", "higher", "highlight", "highlighttext",
      "hiragana", "hiragana-iroha", "horizontal", "hsl", "hsla", "hue", "icon", "ignore",
      "inactiveborder", "inactivecaption", "inactivecaptiontext", "infinite",
      "infobackground", "infotext", "inherit", "initial", "inline", "inline-axis",
      "inline-block", "inline-flex", "inline-grid", "inline-table", "inset", "inside", "intrinsic", "invert",
      "italic", "japanese-formal", "japanese-informal", "justify", "kannada",
      "katakana", "katakana-iroha", "keep-all", "khmer",
      "korean-hangul-formal", "korean-hanja-formal", "korean-hanja-informal",
      "landscape", "lao", "large", "larger", "left", "level", "lighter", "lighten",
      "line-through", "linear", "linear-gradient", "lines", "list-item", "listbox", "listitem",
      "local", "logical", "loud", "lower", "lower-alpha", "lower-armenian",
      "lower-greek", "lower-hexadecimal", "lower-latin", "lower-norwegian",
      "lower-roman", "lowercase", "ltr", "luminosity", "malayalam", "match", "matrix", "matrix3d",
      "media-controls-background", "media-current-time-display",
      "media-fullscreen-button", "media-mute-button", "media-play-button",
      "media-return-to-realtime-button", "media-rewind-button",
      "media-seek-back-button", "media-seek-forward-button", "media-slider",
      "media-sliderthumb", "media-time-remaining-display", "media-volume-slider",
      "media-volume-slider-container", "media-volume-sliderthumb", "medium",
      "menu", "menulist", "menulist-button", "menulist-text",
      "menulist-textfield", "menutext", "message-box", "middle", "min-intrinsic",
      "mix", "mongolian", "monospace", "move", "multiple", "multiply", "myanmar", "n-resize",
      "narrower", "ne-resize", "nesw-resize", "no-close-quote", "no-drop",
      "no-open-quote", "no-repeat", "none", "normal", "not-allowed", "nowrap",
      "ns-resize", "numbers", "numeric", "nw-resize", "nwse-resize", "oblique", "octal", "opacity", "open-quote",
      "optimizeLegibility", "optimizeSpeed", "oriya", "oromo", "outset",
      "outside", "outside-shape", "overlay", "overline", "padding", "padding-box",
      "painted", "page", "paused", "persian", "perspective", "plus-darker", "plus-lighter",
      "pointer", "polygon", "portrait", "pre", "pre-line", "pre-wrap", "preserve-3d",
      "progress", "push-button", "radial-gradient", "radio", "read-only",
      "read-write", "read-write-plaintext-only", "rectangle", "region",
      "relative", "repeat", "repeating-linear-gradient",
      "repeating-radial-gradient", "repeat-x", "repeat-y", "reset", "reverse",
      "rgb", "rgba", "ridge", "right", "rotate", "rotate3d", "rotateX", "rotateY",
      "rotateZ", "round", "row", "row-resize", "row-reverse", "rtl", "run-in", "running",
      "s-resize", "sans-serif", "saturation", "scale", "scale3d", "scaleX", "scaleY", "scaleZ", "screen",
      "scroll", "scrollbar", "scroll-position", "se-resize", "searchfield",
      "searchfield-cancel-button", "searchfield-decoration",
      "searchfield-results-button", "searchfield-results-decoration", "self-start", "self-end",
      "semi-condensed", "semi-expanded", "separate", "serif", "show", "sidama",
      "simp-chinese-formal", "simp-chinese-informal", "single",
      "skew", "skewX", "skewY", "skip-white-space", "slide", "slider-horizontal",
      "slider-vertical", "sliderthumb-horizontal", "sliderthumb-vertical", "slow",
      "small", "small-caps", "small-caption", "smaller", "soft-light", "solid", "somali",
      "source-atop", "source-in", "source-out", "source-over", "space", "space-around", "space-between", "space-evenly", "spell-out", "square",
      "square-button", "start", "static", "status-bar", "stretch", "stroke", "sub",
      "subpixel-antialiased", "super", "sw-resize", "symbolic", "symbols", "system-ui", "table",
      "table-caption", "table-cell", "table-column", "table-column-group",
      "table-footer-group", "table-header-group", "table-row", "table-row-group",
      "tamil",
      "telugu", "text", "text-bottom", "text-top", "textarea", "textfield", "thai",
      "thick", "thin", "threeddarkshadow", "threedface", "threedhighlight",
      "threedlightshadow", "threedshadow", "tibetan", "tigre", "tigrinya-er",
      "tigrinya-er-abegede", "tigrinya-et", "tigrinya-et-abegede", "to", "top",
      "trad-chinese-formal", "trad-chinese-informal", "transform",
      "translate", "translate3d", "translateX", "translateY", "translateZ",
      "transparent", "ultra-condensed", "ultra-expanded", "underline", "unset", "up",
      "upper-alpha", "upper-armenian", "upper-greek", "upper-hexadecimal",
      "upper-latin", "upper-norwegian", "upper-roman", "uppercase", "urdu", "url",
      "var", "vertical", "vertical-text", "visible", "visibleFill", "visiblePainted",
      "visibleStroke", "visual", "w-resize", "wait", "wave", "wider",
      "window", "windowframe", "windowtext", "words", "wrap", "wrap-reverse", "x-large", "x-small", "xor",
      "xx-large", "xx-small"
    ], valueKeywords = keySet(valueKeywords_);
  
    var allWords = documentTypes_.concat(mediaTypes_).concat(mediaFeatures_).concat(mediaValueKeywords_)
      .concat(propertyKeywords_).concat(nonStandardPropertyKeywords_).concat(colorKeywords_)
      .concat(valueKeywords_);
    CodeMirror.registerHelper("hintWords", "css", allWords);
  
    function tokenCComment(stream, state) {
      var maybeEnd = false, ch;
      while ((ch = stream.next()) != null) {
        if (maybeEnd && ch == "/") {
          state.tokenize = null;
          break;
        }
        maybeEnd = (ch == "*");
      }
      return ["comment", "comment"];
    }
  
    CodeMirror.defineMIME("text/css", {
      documentTypes: documentTypes,
      mediaTypes: mediaTypes,
      mediaFeatures: mediaFeatures,
      mediaValueKeywords: mediaValueKeywords,
      propertyKeywords: propertyKeywords,
      nonStandardPropertyKeywords: nonStandardPropertyKeywords,
      fontProperties: fontProperties,
      counterDescriptors: counterDescriptors,
      colorKeywords: colorKeywords,
      valueKeywords: valueKeywords,
      tokenHooks: {
        "/": function(stream, state) {
          if (!stream.eat("*")) return false;
          state.tokenize = tokenCComment;
          return tokenCComment(stream, state);
        }
      },
      name: "css"
    });
  
    CodeMirror.defineMIME("text/x-scss", {
      mediaTypes: mediaTypes,
      mediaFeatures: mediaFeatures,
      mediaValueKeywords: mediaValueKeywords,
      propertyKeywords: propertyKeywords,
      nonStandardPropertyKeywords: nonStandardPropertyKeywords,
      colorKeywords: colorKeywords,
      valueKeywords: valueKeywords,
      fontProperties: fontProperties,
      allowNested: true,
      lineComment: "//",
      tokenHooks: {
        "/": function(stream, state) {
          if (stream.eat("/")) {
            stream.skipToEnd();
            return ["comment", "comment"];
          } else if (stream.eat("*")) {
            state.tokenize = tokenCComment;
            return tokenCComment(stream, state);
          } else {
            return ["operator", "operator"];
          }
        },
        ":": function(stream) {
          if (stream.match(/\s*\{/, false))
            return [null, null]
          return false;
        },
        "$": function(stream) {
          stream.match(/^[\w-]+/);
          if (stream.match(/^\s*:/, false))
            return ["variable-2", "variable-definition"];
          return ["variable-2", "variable"];
        },
        "#": function(stream) {
          if (!stream.eat("{")) return false;
          return [null, "interpolation"];
        }
      },
      name: "css",
      helperType: "scss"
    });
  
    CodeMirror.defineMIME("text/x-less", {
      mediaTypes: mediaTypes,
      mediaFeatures: mediaFeatures,
      mediaValueKeywords: mediaValueKeywords,
      propertyKeywords: propertyKeywords,
      nonStandardPropertyKeywords: nonStandardPropertyKeywords,
      colorKeywords: colorKeywords,
      valueKeywords: valueKeywords,
      fontProperties: fontProperties,
      allowNested: true,
      lineComment: "//",
      tokenHooks: {
        "/": function(stream, state) {
          if (stream.eat("/")) {
            stream.skipToEnd();
            return ["comment", "comment"];
          } else if (stream.eat("*")) {
            state.tokenize = tokenCComment;
            return tokenCComment(stream, state);
          } else {
            return ["operator", "operator"];
          }
        },
        "@": function(stream) {
          if (stream.eat("{")) return [null, "interpolation"];
          if (stream.match(/^(charset|document|font-face|import|(-(moz|ms|o|webkit)-)?keyframes|media|namespace|page|supports)\b/i, false)) return false;
          stream.eatWhile(/[\w\\\-]/);
          if (stream.match(/^\s*:/, false))
            return ["variable-2", "variable-definition"];
          return ["variable-2", "variable"];
        },
        "&": function() {
          return ["atom", "atom"];
        }
      },
      name: "css",
      helperType: "less"
    });
  
    CodeMirror.defineMIME("text/x-gss", {
      documentTypes: documentTypes,
      mediaTypes: mediaTypes,
      mediaFeatures: mediaFeatures,
      propertyKeywords: propertyKeywords,
      nonStandardPropertyKeywords: nonStandardPropertyKeywords,
      fontProperties: fontProperties,
      counterDescriptors: counterDescriptors,
      colorKeywords: colorKeywords,
      valueKeywords: valueKeywords,
      supportsAtComponent: true,
      tokenHooks: {
        "/": function(stream, state) {
          if (!stream.eat("*")) return false;
          state.tokenize = tokenCComment;
          return tokenCComment(stream, state);
        }
      },
      name: "css",
      helperType: "gss"
    });
  
  });


  // CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
      mod(require("../../lib/codemirror"), require("../xml/xml"), require("../javascript/javascript"), require("../css/css"));
    else if (typeof define == "function" && define.amd) // AMD
      define(["../../lib/codemirror", "../xml/xml", "../javascript/javascript", "../css/css"], mod);
    else // Plain browser env
      mod(CodeMirror);
  })(function(CodeMirror) {
    "use strict";
  
    var defaultTags = {
      script: [
        ["lang", /(javascript|babel)/i, "javascript"],
        ["type", /^(?:text|application)\/(?:x-)?(?:java|ecma)script$|^module$|^$/i, "javascript"],
        ["type", /./, "text/plain"],
        [null, null, "javascript"]
      ],
      style:  [
        ["lang", /^css$/i, "css"],
        ["type", /^(text\/)?(x-)?(stylesheet|css)$/i, "css"],
        ["type", /./, "text/plain"],
        [null, null, "css"]
      ]
    };
  
    function maybeBackup(stream, pat, style) {
      var cur = stream.current(), close = cur.search(pat);
      if (close > -1) {
        stream.backUp(cur.length - close);
      } else if (cur.match(/<\/?$/)) {
        stream.backUp(cur.length);
        if (!stream.match(pat, false)) stream.match(cur);
      }
      return style;
    }
  
    var attrRegexpCache = {};
    function getAttrRegexp(attr) {
      var regexp = attrRegexpCache[attr];
      if (regexp) return regexp;
      return attrRegexpCache[attr] = new RegExp("\\s+" + attr + "\\s*=\\s*('|\")?([^'\"]+)('|\")?\\s*");
    }
  
    function getAttrValue(text, attr) {
      var match = text.match(getAttrRegexp(attr))
      return match ? /^\s*(.*?)\s*$/.exec(match[2])[1] : ""
    }
  
    function getTagRegexp(tagName, anchored) {
      return new RegExp((anchored ? "^" : "") + "<\/\s*" + tagName + "\s*>", "i");
    }
  
    function addTags(from, to) {
      for (var tag in from) {
        var dest = to[tag] || (to[tag] = []);
        var source = from[tag];
        for (var i = source.length - 1; i >= 0; i--)
          dest.unshift(source[i])
      }
    }
  
    function findMatchingMode(tagInfo, tagText) {
      for (var i = 0; i < tagInfo.length; i++) {
        var spec = tagInfo[i];
        if (!spec[0] || spec[1].test(getAttrValue(tagText, spec[0]))) return spec[2];
      }
    }
  
    CodeMirror.defineMode("htmlmixed", function (config, parserConfig) {
      var htmlMode = CodeMirror.getMode(config, {
        name: "xml",
        htmlMode: true,
        multilineTagIndentFactor: parserConfig.multilineTagIndentFactor,
        multilineTagIndentPastTag: parserConfig.multilineTagIndentPastTag
      });
  
      var tags = {};
      var configTags = parserConfig && parserConfig.tags, configScript = parserConfig && parserConfig.scriptTypes;
      addTags(defaultTags, tags);
      if (configTags) addTags(configTags, tags);
      if (configScript) for (var i = configScript.length - 1; i >= 0; i--)
        tags.script.unshift(["type", configScript[i].matches, configScript[i].mode])
  
      function html(stream, state) {
        var style = htmlMode.token(stream, state.htmlState), tag = /\btag\b/.test(style), tagName
        if (tag && !/[<>\s\/]/.test(stream.current()) &&
            (tagName = state.htmlState.tagName && state.htmlState.tagName.toLowerCase()) &&
            tags.hasOwnProperty(tagName)) {
          state.inTag = tagName + " "
        } else if (state.inTag && tag && />$/.test(stream.current())) {
          var inTag = /^([\S]+) (.*)/.exec(state.inTag)
          state.inTag = null
          var modeSpec = stream.current() == ">" && findMatchingMode(tags[inTag[1]], inTag[2])
          var mode = CodeMirror.getMode(config, modeSpec)
          var endTagA = getTagRegexp(inTag[1], true), endTag = getTagRegexp(inTag[1], false);
          state.token = function (stream, state) {
            if (stream.match(endTagA, false)) {
              state.token = html;
              state.localState = state.localMode = null;
              return null;
            }
            return maybeBackup(stream, endTag, state.localMode.token(stream, state.localState));
          };
          state.localMode = mode;
          state.localState = CodeMirror.startState(mode, htmlMode.indent(state.htmlState, "", ""));
        } else if (state.inTag) {
          state.inTag += stream.current()
          if (stream.eol()) state.inTag += " "
        }
        return style;
      };
  
      return {
        startState: function () {
          var state = CodeMirror.startState(htmlMode);
          return {token: html, inTag: null, localMode: null, localState: null, htmlState: state};
        },
  
        copyState: function (state) {
          var local;
          if (state.localState) {
            local = CodeMirror.copyState(state.localMode, state.localState);
          }
          return {token: state.token, inTag: state.inTag,
                  localMode: state.localMode, localState: local,
                  htmlState: CodeMirror.copyState(htmlMode, state.htmlState)};
        },
  
        token: function (stream, state) {
          return state.token(stream, state);
        },
  
        indent: function (state, textAfter, line) {
          if (!state.localMode || /^\s*<\//.test(textAfter))
            return htmlMode.indent(state.htmlState, textAfter, line);
          else if (state.localMode.indent)
            return state.localMode.indent(state.localState, textAfter, line);
          else
            return CodeMirror.Pass;
        },
  
        innerMode: function (state) {
          return {state: state.localState || state.htmlState, mode: state.localMode || htmlMode};
        }
      };
    }, "xml", "javascript", "css");
  
    CodeMirror.defineMIME("text/html", "htmlmixed");
  });

  // CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
      mod(require("../../lib/codemirror"), require("../xml/xml"), require("../meta"));
    else if (typeof define == "function" && define.amd) // AMD
      define(["../../lib/codemirror", "../xml/xml", "../meta"], mod);
    else // Plain browser env
      mod(CodeMirror);
  })(function(CodeMirror) {
  "use strict";
  
  CodeMirror.defineMode("markdown", function(cmCfg, modeCfg) {
  
    var htmlMode = CodeMirror.getMode(cmCfg, "text/html");
    var htmlModeMissing = htmlMode.name == "null"
  
    function getMode(name) {
      if (CodeMirror.findModeByName) {
        var found = CodeMirror.findModeByName(name);
        if (found) name = found.mime || found.mimes[0];
      }
      var mode = CodeMirror.getMode(cmCfg, name);
      return mode.name == "null" ? null : mode;
    }
  
    // Should characters that affect highlighting be highlighted separate?
    // Does not include characters that will be output (such as `1.` and `-` for lists)
    if (modeCfg.highlightFormatting === undefined)
      modeCfg.highlightFormatting = false;
  
    // Maximum number of nested blockquotes. Set to 0 for infinite nesting.
    // Excess `>` will emit `error` token.
    if (modeCfg.maxBlockquoteDepth === undefined)
      modeCfg.maxBlockquoteDepth = 0;
  
    // Turn on task lists? ("- [ ] " and "- [x] ")
    if (modeCfg.taskLists === undefined) modeCfg.taskLists = false;
  
    // Turn on strikethrough syntax
    if (modeCfg.strikethrough === undefined)
      modeCfg.strikethrough = false;
  
    if (modeCfg.emoji === undefined)
      modeCfg.emoji = false;
  
    if (modeCfg.fencedCodeBlockHighlighting === undefined)
      modeCfg.fencedCodeBlockHighlighting = true;
    
    if (modeCfg.fencedCodeBlockDefaultMode === undefined)
      modeCfg.fencedCodeBlockDefaultMode = '';
  
    if (modeCfg.xml === undefined)
      modeCfg.xml = true;
  
    // Allow token types to be overridden by user-provided token types.
    if (modeCfg.tokenTypeOverrides === undefined)
      modeCfg.tokenTypeOverrides = {};
  
    var tokenTypes = {
      header: "header",
      code: "comment",
      quote: "quote",
      list1: "variable-2",
      list2: "variable-3",
      list3: "keyword",
      hr: "hr",
      image: "image",
      imageAltText: "image-alt-text",
      imageMarker: "image-marker",
      formatting: "formatting",
      linkInline: "link",
      linkEmail: "link",
      linkText: "link",
      linkHref: "string",
      em: "em",
      strong: "strong",
      strikethrough: "strikethrough",
      emoji: "builtin"
    };
  
    for (var tokenType in tokenTypes) {
      if (tokenTypes.hasOwnProperty(tokenType) && modeCfg.tokenTypeOverrides[tokenType]) {
        tokenTypes[tokenType] = modeCfg.tokenTypeOverrides[tokenType];
      }
    }
  
    var hrRE = /^([*\-_])(?:\s*\1){2,}\s*$/
    ,   listRE = /^(?:[*\-+]|^[0-9]+([.)]))\s+/
    ,   taskListRE = /^\[(x| )\](?=\s)/i // Must follow listRE
    ,   atxHeaderRE = modeCfg.allowAtxHeaderWithoutSpace ? /^(#+)/ : /^(#+)(?: |$)/
    ,   setextHeaderRE = /^ {0,3}(?:\={1,}|-{2,})\s*$/
    ,   textRE = /^[^#!\[\]*_\\<>` "'(~:]+/
    ,   fencedCodeRE = /^(~~~+|```+)[ \t]*([\w+#-]*)[^\n`]*$/
    ,   linkDefRE = /^\s*\[[^\]]+?\]:.*$/ // naive link-definition
    ,   punctuation = /[!"#$%&'()*+,\-.\/:;<=>?@\[\\\]^_`{|}~\xA1\xA7\xAB\xB6\xB7\xBB\xBF\u037E\u0387\u055A-\u055F\u0589\u058A\u05BE\u05C0\u05C3\u05C6\u05F3\u05F4\u0609\u060A\u060C\u060D\u061B\u061E\u061F\u066A-\u066D\u06D4\u0700-\u070D\u07F7-\u07F9\u0830-\u083E\u085E\u0964\u0965\u0970\u0AF0\u0DF4\u0E4F\u0E5A\u0E5B\u0F04-\u0F12\u0F14\u0F3A-\u0F3D\u0F85\u0FD0-\u0FD4\u0FD9\u0FDA\u104A-\u104F\u10FB\u1360-\u1368\u1400\u166D\u166E\u169B\u169C\u16EB-\u16ED\u1735\u1736\u17D4-\u17D6\u17D8-\u17DA\u1800-\u180A\u1944\u1945\u1A1E\u1A1F\u1AA0-\u1AA6\u1AA8-\u1AAD\u1B5A-\u1B60\u1BFC-\u1BFF\u1C3B-\u1C3F\u1C7E\u1C7F\u1CC0-\u1CC7\u1CD3\u2010-\u2027\u2030-\u2043\u2045-\u2051\u2053-\u205E\u207D\u207E\u208D\u208E\u2308-\u230B\u2329\u232A\u2768-\u2775\u27C5\u27C6\u27E6-\u27EF\u2983-\u2998\u29D8-\u29DB\u29FC\u29FD\u2CF9-\u2CFC\u2CFE\u2CFF\u2D70\u2E00-\u2E2E\u2E30-\u2E42\u3001-\u3003\u3008-\u3011\u3014-\u301F\u3030\u303D\u30A0\u30FB\uA4FE\uA4FF\uA60D-\uA60F\uA673\uA67E\uA6F2-\uA6F7\uA874-\uA877\uA8CE\uA8CF\uA8F8-\uA8FA\uA8FC\uA92E\uA92F\uA95F\uA9C1-\uA9CD\uA9DE\uA9DF\uAA5C-\uAA5F\uAADE\uAADF\uAAF0\uAAF1\uABEB\uFD3E\uFD3F\uFE10-\uFE19\uFE30-\uFE52\uFE54-\uFE61\uFE63\uFE68\uFE6A\uFE6B\uFF01-\uFF03\uFF05-\uFF0A\uFF0C-\uFF0F\uFF1A\uFF1B\uFF1F\uFF20\uFF3B-\uFF3D\uFF3F\uFF5B\uFF5D\uFF5F-\uFF65]|\uD800[\uDD00-\uDD02\uDF9F\uDFD0]|\uD801\uDD6F|\uD802[\uDC57\uDD1F\uDD3F\uDE50-\uDE58\uDE7F\uDEF0-\uDEF6\uDF39-\uDF3F\uDF99-\uDF9C]|\uD804[\uDC47-\uDC4D\uDCBB\uDCBC\uDCBE-\uDCC1\uDD40-\uDD43\uDD74\uDD75\uDDC5-\uDDC9\uDDCD\uDDDB\uDDDD-\uDDDF\uDE38-\uDE3D\uDEA9]|\uD805[\uDCC6\uDDC1-\uDDD7\uDE41-\uDE43\uDF3C-\uDF3E]|\uD809[\uDC70-\uDC74]|\uD81A[\uDE6E\uDE6F\uDEF5\uDF37-\uDF3B\uDF44]|\uD82F\uDC9F|\uD836[\uDE87-\uDE8B]/
    ,   expandedTab = "    " // CommonMark specifies tab as 4 spaces
  
    function switchInline(stream, state, f) {
      state.f = state.inline = f;
      return f(stream, state);
    }
  
    function switchBlock(stream, state, f) {
      state.f = state.block = f;
      return f(stream, state);
    }
  
    function lineIsEmpty(line) {
      return !line || !/\S/.test(line.string)
    }
  
    // Blocks
  
    function blankLine(state) {
      // Reset linkTitle state
      state.linkTitle = false;
      state.linkHref = false;
      state.linkText = false;
      // Reset EM state
      state.em = false;
      // Reset STRONG state
      state.strong = false;
      // Reset strikethrough state
      state.strikethrough = false;
      // Reset state.quote
      state.quote = 0;
      // Reset state.indentedCode
      state.indentedCode = false;
      if (state.f == htmlBlock) {
        var exit = htmlModeMissing
        if (!exit) {
          var inner = CodeMirror.innerMode(htmlMode, state.htmlState)
          exit = inner.mode.name == "xml" && inner.state.tagStart === null &&
            (!inner.state.context && inner.state.tokenize.isInText)
        }
        if (exit) {
          state.f = inlineNormal;
          state.block = blockNormal;
          state.htmlState = null;
        }
      }
      // Reset state.trailingSpace
      state.trailingSpace = 0;
      state.trailingSpaceNewLine = false;
      // Mark this line as blank
      state.prevLine = state.thisLine
      state.thisLine = {stream: null}
      return null;
    }
  
    function blockNormal(stream, state) {
      var firstTokenOnLine = stream.column() === state.indentation;
      var prevLineLineIsEmpty = lineIsEmpty(state.prevLine.stream);
      var prevLineIsIndentedCode = state.indentedCode;
      var prevLineIsHr = state.prevLine.hr;
      var prevLineIsList = state.list !== false;
      var maxNonCodeIndentation = (state.listStack[state.listStack.length - 1] || 0) + 3;
  
      state.indentedCode = false;
  
      var lineIndentation = state.indentation;
      // compute once per line (on first token)
      if (state.indentationDiff === null) {
        state.indentationDiff = state.indentation;
        if (prevLineIsList) {
          state.list = null;
          // While this list item's marker's indentation is less than the deepest
          //  list item's content's indentation,pop the deepest list item
          //  indentation off the stack, and update block indentation state
          while (lineIndentation < state.listStack[state.listStack.length - 1]) {
            state.listStack.pop();
            if (state.listStack.length) {
              state.indentation = state.listStack[state.listStack.length - 1];
            // less than the first list's indent -> the line is no longer a list
            } else {
              state.list = false;
            }
          }
          if (state.list !== false) {
            state.indentationDiff = lineIndentation - state.listStack[state.listStack.length - 1]
          }
        }
      }
  
      // not comprehensive (currently only for setext detection purposes)
      var allowsInlineContinuation = (
          !prevLineLineIsEmpty && !prevLineIsHr && !state.prevLine.header &&
          (!prevLineIsList || !prevLineIsIndentedCode) &&
          !state.prevLine.fencedCodeEnd
      );
  
      var isHr = (state.list === false || prevLineIsHr || prevLineLineIsEmpty) &&
        state.indentation <= maxNonCodeIndentation && stream.match(hrRE);
  
      var match = null;
      if (state.indentationDiff >= 4 && (prevLineIsIndentedCode || state.prevLine.fencedCodeEnd ||
           state.prevLine.header || prevLineLineIsEmpty)) {
        stream.skipToEnd();
        state.indentedCode = true;
        return tokenTypes.code;
      } else if (stream.eatSpace()) {
        return null;
      } else if (firstTokenOnLine && state.indentation <= maxNonCodeIndentation && (match = stream.match(atxHeaderRE)) && match[1].length <= 6) {
        state.quote = 0;
        state.header = match[1].length;
        state.thisLine.header = true;
        if (modeCfg.highlightFormatting) state.formatting = "header";
        state.f = state.inline;
        return getType(state);
      } else if (state.indentation <= maxNonCodeIndentation && stream.eat('>')) {
        state.quote = firstTokenOnLine ? 1 : state.quote + 1;
        if (modeCfg.highlightFormatting) state.formatting = "quote";
        stream.eatSpace();
        return getType(state);
      } else if (!isHr && !state.setext && firstTokenOnLine && state.indentation <= maxNonCodeIndentation && (match = stream.match(listRE))) {
        var listType = match[1] ? "ol" : "ul";
  
        state.indentation = lineIndentation + stream.current().length;
        state.list = true;
        state.quote = 0;
  
        // Add this list item's content's indentation to the stack
        state.listStack.push(state.indentation);
        // Reset inline styles which shouldn't propagate aross list items
        state.em = false;
        state.strong = false;
        state.code = false;
        state.strikethrough = false;
  
        if (modeCfg.taskLists && stream.match(taskListRE, false)) {
          state.taskList = true;
        }
        state.f = state.inline;
        if (modeCfg.highlightFormatting) state.formatting = ["list", "list-" + listType];
        return getType(state);
      } else if (firstTokenOnLine && state.indentation <= maxNonCodeIndentation && (match = stream.match(fencedCodeRE, true))) {
        state.quote = 0;
        state.fencedEndRE = new RegExp(match[1] + "+ *$");
        // try switching mode
        state.localMode = modeCfg.fencedCodeBlockHighlighting && getMode(match[2] || modeCfg.fencedCodeBlockDefaultMode );
        if (state.localMode) state.localState = CodeMirror.startState(state.localMode);
        state.f = state.block = local;
        if (modeCfg.highlightFormatting) state.formatting = "code-block";
        state.code = -1
        return getType(state);
      // SETEXT has lowest block-scope precedence after HR, so check it after
      //  the others (code, blockquote, list...)
      } else if (
        // if setext set, indicates line after ---/===
        state.setext || (
          // line before ---/===
          (!allowsInlineContinuation || !prevLineIsList) && !state.quote && state.list === false &&
          !state.code && !isHr && !linkDefRE.test(stream.string) &&
          (match = stream.lookAhead(1)) && (match = match.match(setextHeaderRE))
        )
      ) {
        if ( !state.setext ) {
          state.header = match[0].charAt(0) == '=' ? 1 : 2;
          state.setext = state.header;
        } else {
          state.header = state.setext;
          // has no effect on type so we can reset it now
          state.setext = 0;
          stream.skipToEnd();
          if (modeCfg.highlightFormatting) state.formatting = "header";
        }
        state.thisLine.header = true;
        state.f = state.inline;
        return getType(state);
      } else if (isHr) {
        stream.skipToEnd();
        state.hr = true;
        state.thisLine.hr = true;
        return tokenTypes.hr;
      } else if (stream.peek() === '[') {
        return switchInline(stream, state, footnoteLink);
      }
  
      return switchInline(stream, state, state.inline);
    }
  
    function htmlBlock(stream, state) {
      var style = htmlMode.token(stream, state.htmlState);
      if (!htmlModeMissing) {
        var inner = CodeMirror.innerMode(htmlMode, state.htmlState)
        if ((inner.mode.name == "xml" && inner.state.tagStart === null &&
             (!inner.state.context && inner.state.tokenize.isInText)) ||
            (state.md_inside && stream.current().indexOf(">") > -1)) {
          state.f = inlineNormal;
          state.block = blockNormal;
          state.htmlState = null;
        }
      }
      return style;
    }
  
    function local(stream, state) {
      var currListInd = state.listStack[state.listStack.length - 1] || 0;
      var hasExitedList = state.indentation < currListInd;
      var maxFencedEndInd = currListInd + 3;
      if (state.fencedEndRE && state.indentation <= maxFencedEndInd && (hasExitedList || stream.match(state.fencedEndRE))) {
        if (modeCfg.highlightFormatting) state.formatting = "code-block";
        var returnType;
        if (!hasExitedList) returnType = getType(state)
        state.localMode = state.localState = null;
        state.block = blockNormal;
        state.f = inlineNormal;
        state.fencedEndRE = null;
        state.code = 0
        state.thisLine.fencedCodeEnd = true;
        if (hasExitedList) return switchBlock(stream, state, state.block);
        return returnType;
      } else if (state.localMode) {
        return state.localMode.token(stream, state.localState);
      } else {
        stream.skipToEnd();
        return tokenTypes.code;
      }
    }
  
    // Inline
    function getType(state) {
      var styles = [];
  
      if (state.formatting) {
        styles.push(tokenTypes.formatting);
  
        if (typeof state.formatting === "string") state.formatting = [state.formatting];
  
        for (var i = 0; i < state.formatting.length; i++) {
          styles.push(tokenTypes.formatting + "-" + state.formatting[i]);
  
          if (state.formatting[i] === "header") {
            styles.push(tokenTypes.formatting + "-" + state.formatting[i] + "-" + state.header);
          }
  
          // Add `formatting-quote` and `formatting-quote-#` for blockquotes
          // Add `error` instead if the maximum blockquote nesting depth is passed
          if (state.formatting[i] === "quote") {
            if (!modeCfg.maxBlockquoteDepth || modeCfg.maxBlockquoteDepth >= state.quote) {
              styles.push(tokenTypes.formatting + "-" + state.formatting[i] + "-" + state.quote);
            } else {
              styles.push("error");
            }
          }
        }
      }
  
      if (state.taskOpen) {
        styles.push("meta");
        return styles.length ? styles.join(' ') : null;
      }
      if (state.taskClosed) {
        styles.push("property");
        return styles.length ? styles.join(' ') : null;
      }
  
      if (state.linkHref) {
        styles.push(tokenTypes.linkHref, "url");
      } else { // Only apply inline styles to non-url text
        if (state.strong) { styles.push(tokenTypes.strong); }
        if (state.em) { styles.push(tokenTypes.em); }
        if (state.strikethrough) { styles.push(tokenTypes.strikethrough); }
        if (state.emoji) { styles.push(tokenTypes.emoji); }
        if (state.linkText) { styles.push(tokenTypes.linkText); }
        if (state.code) { styles.push(tokenTypes.code); }
        if (state.image) { styles.push(tokenTypes.image); }
        if (state.imageAltText) { styles.push(tokenTypes.imageAltText, "link"); }
        if (state.imageMarker) { styles.push(tokenTypes.imageMarker); }
      }
  
      if (state.header) { styles.push(tokenTypes.header, tokenTypes.header + "-" + state.header); }
  
      if (state.quote) {
        styles.push(tokenTypes.quote);
  
        // Add `quote-#` where the maximum for `#` is modeCfg.maxBlockquoteDepth
        if (!modeCfg.maxBlockquoteDepth || modeCfg.maxBlockquoteDepth >= state.quote) {
          styles.push(tokenTypes.quote + "-" + state.quote);
        } else {
          styles.push(tokenTypes.quote + "-" + modeCfg.maxBlockquoteDepth);
        }
      }
  
      if (state.list !== false) {
        var listMod = (state.listStack.length - 1) % 3;
        if (!listMod) {
          styles.push(tokenTypes.list1);
        } else if (listMod === 1) {
          styles.push(tokenTypes.list2);
        } else {
          styles.push(tokenTypes.list3);
        }
      }
  
      if (state.trailingSpaceNewLine) {
        styles.push("trailing-space-new-line");
      } else if (state.trailingSpace) {
        styles.push("trailing-space-" + (state.trailingSpace % 2 ? "a" : "b"));
      }
  
      return styles.length ? styles.join(' ') : null;
    }
  
    function handleText(stream, state) {
      if (stream.match(textRE, true)) {
        return getType(state);
      }
      return undefined;
    }
  
    function inlineNormal(stream, state) {
      var style = state.text(stream, state);
      if (typeof style !== 'undefined')
        return style;
  
      if (state.list) { // List marker (*, +, -, 1., etc)
        state.list = null;
        return getType(state);
      }
  
      if (state.taskList) {
        var taskOpen = stream.match(taskListRE, true)[1] === " ";
        if (taskOpen) state.taskOpen = true;
        else state.taskClosed = true;
        if (modeCfg.highlightFormatting) state.formatting = "task";
        state.taskList = false;
        return getType(state);
      }
  
      state.taskOpen = false;
      state.taskClosed = false;
  
      if (state.header && stream.match(/^#+$/, true)) {
        if (modeCfg.highlightFormatting) state.formatting = "header";
        return getType(state);
      }
  
      var ch = stream.next();
  
      // Matches link titles present on next line
      if (state.linkTitle) {
        state.linkTitle = false;
        var matchCh = ch;
        if (ch === '(') {
          matchCh = ')';
        }
        matchCh = (matchCh+'').replace(/([.?*+^\[\]\\(){}|-])/g, "\\$1");
        var regex = '^\\s*(?:[^' + matchCh + '\\\\]+|\\\\\\\\|\\\\.)' + matchCh;
        if (stream.match(new RegExp(regex), true)) {
          return tokenTypes.linkHref;
        }
      }
  
      // If this block is changed, it may need to be updated in GFM mode
      if (ch === '`') {
        var previousFormatting = state.formatting;
        if (modeCfg.highlightFormatting) state.formatting = "code";
        stream.eatWhile('`');
        var count = stream.current().length
        if (state.code == 0 && (!state.quote || count == 1)) {
          state.code = count
          return getType(state)
        } else if (count == state.code) { // Must be exact
          var t = getType(state)
          state.code = 0
          return t
        } else {
          state.formatting = previousFormatting
          return getType(state)
        }
      } else if (state.code) {
        return getType(state);
      }
  
      if (ch === '\\') {
        stream.next();
        if (modeCfg.highlightFormatting) {
          var type = getType(state);
          var formattingEscape = tokenTypes.formatting + "-escape";
          return type ? type + " " + formattingEscape : formattingEscape;
        }
      }
  
      if (ch === '!' && stream.match(/\[[^\]]*\] ?(?:\(|\[)/, false)) {
        state.imageMarker = true;
        state.image = true;
        if (modeCfg.highlightFormatting) state.formatting = "image";
        return getType(state);
      }
  
      if (ch === '[' && state.imageMarker && stream.match(/[^\]]*\](\(.*?\)| ?\[.*?\])/, false)) {
        state.imageMarker = false;
        state.imageAltText = true
        if (modeCfg.highlightFormatting) state.formatting = "image";
        return getType(state);
      }
  
      if (ch === ']' && state.imageAltText) {
        if (modeCfg.highlightFormatting) state.formatting = "image";
        var type = getType(state);
        state.imageAltText = false;
        state.image = false;
        state.inline = state.f = linkHref;
        return type;
      }
  
      if (ch === '[' && !state.image) {
        if (state.linkText && stream.match(/^.*?\]/)) return getType(state)
        state.linkText = true;
        if (modeCfg.highlightFormatting) state.formatting = "link";
        return getType(state);
      }
  
      if (ch === ']' && state.linkText) {
        if (modeCfg.highlightFormatting) state.formatting = "link";
        var type = getType(state);
        state.linkText = false;
        state.inline = state.f = stream.match(/\(.*?\)| ?\[.*?\]/, false) ? linkHref : inlineNormal
        return type;
      }
  
      if (ch === '<' && stream.match(/^(https?|ftps?):\/\/(?:[^\\>]|\\.)+>/, false)) {
        state.f = state.inline = linkInline;
        if (modeCfg.highlightFormatting) state.formatting = "link";
        var type = getType(state);
        if (type){
          type += " ";
        } else {
          type = "";
        }
        return type + tokenTypes.linkInline;
      }
  
      if (ch === '<' && stream.match(/^[^> \\]+@(?:[^\\>]|\\.)+>/, false)) {
        state.f = state.inline = linkInline;
        if (modeCfg.highlightFormatting) state.formatting = "link";
        var type = getType(state);
        if (type){
          type += " ";
        } else {
          type = "";
        }
        return type + tokenTypes.linkEmail;
      }
  
      if (modeCfg.xml && ch === '<' && stream.match(/^(!--|\?|!\[CDATA\[|[a-z][a-z0-9-]*(?:\s+[a-z_:.\-]+(?:\s*=\s*[^>]+)?)*\s*(?:>|$))/i, false)) {
        var end = stream.string.indexOf(">", stream.pos);
        if (end != -1) {
          var atts = stream.string.substring(stream.start, end);
          if (/markdown\s*=\s*('|"){0,1}1('|"){0,1}/.test(atts)) state.md_inside = true;
        }
        stream.backUp(1);
        state.htmlState = CodeMirror.startState(htmlMode);
        return switchBlock(stream, state, htmlBlock);
      }
  
      if (modeCfg.xml && ch === '<' && stream.match(/^\/\w*?>/)) {
        state.md_inside = false;
        return "tag";
      } else if (ch === "*" || ch === "_") {
        var len = 1, before = stream.pos == 1 ? " " : stream.string.charAt(stream.pos - 2)
        while (len < 3 && stream.eat(ch)) len++
        var after = stream.peek() || " "
        // See http://spec.commonmark.org/0.27/#emphasis-and-strong-emphasis
        var leftFlanking = !/\s/.test(after) && (!punctuation.test(after) || /\s/.test(before) || punctuation.test(before))
        var rightFlanking = !/\s/.test(before) && (!punctuation.test(before) || /\s/.test(after) || punctuation.test(after))
        var setEm = null, setStrong = null
        if (len % 2) { // Em
          if (!state.em && leftFlanking && (ch === "*" || !rightFlanking || punctuation.test(before)))
            setEm = true
          else if (state.em == ch && rightFlanking && (ch === "*" || !leftFlanking || punctuation.test(after)))
            setEm = false
        }
        if (len > 1) { // Strong
          if (!state.strong && leftFlanking && (ch === "*" || !rightFlanking || punctuation.test(before)))
            setStrong = true
          else if (state.strong == ch && rightFlanking && (ch === "*" || !leftFlanking || punctuation.test(after)))
            setStrong = false
        }
        if (setStrong != null || setEm != null) {
          if (modeCfg.highlightFormatting) state.formatting = setEm == null ? "strong" : setStrong == null ? "em" : "strong em"
          if (setEm === true) state.em = ch
          if (setStrong === true) state.strong = ch
          var t = getType(state)
          if (setEm === false) state.em = false
          if (setStrong === false) state.strong = false
          return t
        }
      } else if (ch === ' ') {
        if (stream.eat('*') || stream.eat('_')) { // Probably surrounded by spaces
          if (stream.peek() === ' ') { // Surrounded by spaces, ignore
            return getType(state);
          } else { // Not surrounded by spaces, back up pointer
            stream.backUp(1);
          }
        }
      }
  
      if (modeCfg.strikethrough) {
        if (ch === '~' && stream.eatWhile(ch)) {
          if (state.strikethrough) {// Remove strikethrough
            if (modeCfg.highlightFormatting) state.formatting = "strikethrough";
            var t = getType(state);
            state.strikethrough = false;
            return t;
          } else if (stream.match(/^[^\s]/, false)) {// Add strikethrough
            state.strikethrough = true;
            if (modeCfg.highlightFormatting) state.formatting = "strikethrough";
            return getType(state);
          }
        } else if (ch === ' ') {
          if (stream.match(/^~~/, true)) { // Probably surrounded by space
            if (stream.peek() === ' ') { // Surrounded by spaces, ignore
              return getType(state);
            } else { // Not surrounded by spaces, back up pointer
              stream.backUp(2);
            }
          }
        }
      }
  
      if (modeCfg.emoji && ch === ":" && stream.match(/^(?:[a-z_\d+][a-z_\d+-]*|\-[a-z_\d+][a-z_\d+-]*):/)) {
        state.emoji = true;
        if (modeCfg.highlightFormatting) state.formatting = "emoji";
        var retType = getType(state);
        state.emoji = false;
        return retType;
      }
  
      if (ch === ' ') {
        if (stream.match(/^ +$/, false)) {
          state.trailingSpace++;
        } else if (state.trailingSpace) {
          state.trailingSpaceNewLine = true;
        }
      }
  
      return getType(state);
    }
  
    function linkInline(stream, state) {
      var ch = stream.next();
  
      if (ch === ">") {
        state.f = state.inline = inlineNormal;
        if (modeCfg.highlightFormatting) state.formatting = "link";
        var type = getType(state);
        if (type){
          type += " ";
        } else {
          type = "";
        }
        return type + tokenTypes.linkInline;
      }
  
      stream.match(/^[^>]+/, true);
  
      return tokenTypes.linkInline;
    }
  
    function linkHref(stream, state) {
      // Check if space, and return NULL if so (to avoid marking the space)
      if(stream.eatSpace()){
        return null;
      }
      var ch = stream.next();
      if (ch === '(' || ch === '[') {
        state.f = state.inline = getLinkHrefInside(ch === "(" ? ")" : "]");
        if (modeCfg.highlightFormatting) state.formatting = "link-string";
        state.linkHref = true;
        return getType(state);
      }
      return 'error';
    }
  
    var linkRE = {
      ")": /^(?:[^\\\(\)]|\\.|\((?:[^\\\(\)]|\\.)*\))*?(?=\))/,
      "]": /^(?:[^\\\[\]]|\\.|\[(?:[^\\\[\]]|\\.)*\])*?(?=\])/
    }
  
    function getLinkHrefInside(endChar) {
      return function(stream, state) {
        var ch = stream.next();
  
        if (ch === endChar) {
          state.f = state.inline = inlineNormal;
          if (modeCfg.highlightFormatting) state.formatting = "link-string";
          var returnState = getType(state);
          state.linkHref = false;
          return returnState;
        }
  
        stream.match(linkRE[endChar])
        state.linkHref = true;
        return getType(state);
      };
    }
  
    function footnoteLink(stream, state) {
      if (stream.match(/^([^\]\\]|\\.)*\]:/, false)) {
        state.f = footnoteLinkInside;
        stream.next(); // Consume [
        if (modeCfg.highlightFormatting) state.formatting = "link";
        state.linkText = true;
        return getType(state);
      }
      return switchInline(stream, state, inlineNormal);
    }
  
    function footnoteLinkInside(stream, state) {
      if (stream.match(/^\]:/, true)) {
        state.f = state.inline = footnoteUrl;
        if (modeCfg.highlightFormatting) state.formatting = "link";
        var returnType = getType(state);
        state.linkText = false;
        return returnType;
      }
  
      stream.match(/^([^\]\\]|\\.)+/, true);
  
      return tokenTypes.linkText;
    }
  
    function footnoteUrl(stream, state) {
      // Check if space, and return NULL if so (to avoid marking the space)
      if(stream.eatSpace()){
        return null;
      }
      // Match URL
      stream.match(/^[^\s]+/, true);
      // Check for link title
      if (stream.peek() === undefined) { // End of line, set flag to check next line
        state.linkTitle = true;
      } else { // More content on line, check if link title
        stream.match(/^(?:\s+(?:"(?:[^"\\]|\\\\|\\.)+"|'(?:[^'\\]|\\\\|\\.)+'|\((?:[^)\\]|\\\\|\\.)+\)))?/, true);
      }
      state.f = state.inline = inlineNormal;
      return tokenTypes.linkHref + " url";
    }
  
    var mode = {
      startState: function() {
        return {
          f: blockNormal,
  
          prevLine: {stream: null},
          thisLine: {stream: null},
  
          block: blockNormal,
          htmlState: null,
          indentation: 0,
  
          inline: inlineNormal,
          text: handleText,
  
          formatting: false,
          linkText: false,
          linkHref: false,
          linkTitle: false,
          code: 0,
          em: false,
          strong: false,
          header: 0,
          setext: 0,
          hr: false,
          taskList: false,
          list: false,
          listStack: [],
          quote: 0,
          trailingSpace: 0,
          trailingSpaceNewLine: false,
          strikethrough: false,
          emoji: false,
          fencedEndRE: null
        };
      },
  
      copyState: function(s) {
        return {
          f: s.f,
  
          prevLine: s.prevLine,
          thisLine: s.thisLine,
  
          block: s.block,
          htmlState: s.htmlState && CodeMirror.copyState(htmlMode, s.htmlState),
          indentation: s.indentation,
  
          localMode: s.localMode,
          localState: s.localMode ? CodeMirror.copyState(s.localMode, s.localState) : null,
  
          inline: s.inline,
          text: s.text,
          formatting: false,
          linkText: s.linkText,
          linkTitle: s.linkTitle,
          linkHref: s.linkHref,
          code: s.code,
          em: s.em,
          strong: s.strong,
          strikethrough: s.strikethrough,
          emoji: s.emoji,
          header: s.header,
          setext: s.setext,
          hr: s.hr,
          taskList: s.taskList,
          list: s.list,
          listStack: s.listStack.slice(0),
          quote: s.quote,
          indentedCode: s.indentedCode,
          trailingSpace: s.trailingSpace,
          trailingSpaceNewLine: s.trailingSpaceNewLine,
          md_inside: s.md_inside,
          fencedEndRE: s.fencedEndRE
        };
      },
  
      token: function(stream, state) {
  
        // Reset state.formatting
        state.formatting = false;
  
        if (stream != state.thisLine.stream) {
          state.header = 0;
          state.hr = false;
  
          if (stream.match(/^\s*$/, true)) {
            blankLine(state);
            return null;
          }
  
          state.prevLine = state.thisLine
          state.thisLine = {stream: stream}
  
          // Reset state.taskList
          state.taskList = false;
  
          // Reset state.trailingSpace
          state.trailingSpace = 0;
          state.trailingSpaceNewLine = false;
  
          if (!state.localState) {
            state.f = state.block;
            if (state.f != htmlBlock) {
              var indentation = stream.match(/^\s*/, true)[0].replace(/\t/g, expandedTab).length;
              state.indentation = indentation;
              state.indentationDiff = null;
              if (indentation > 0) return null;
            }
          }
        }
        return state.f(stream, state);
      },
  
      innerMode: function(state) {
        if (state.block == htmlBlock) return {state: state.htmlState, mode: htmlMode};
        if (state.localState) return {state: state.localState, mode: state.localMode};
        return {state: state, mode: mode};
      },
  
      indent: function(state, textAfter, line) {
        if (state.block == htmlBlock && htmlMode.indent) return htmlMode.indent(state.htmlState, textAfter, line)
        if (state.localState && state.localMode.indent) return state.localMode.indent(state.localState, textAfter, line)
        return CodeMirror.Pass
      },
  
      blankLine: blankLine,
  
      getType: getType,
  
      blockCommentStart: "<!--",
      blockCommentEnd: "-->",
      closeBrackets: "()[]{}''\"\"``",
      fold: "markdown"
    };
    return mode;
  }, "xml");
  
  CodeMirror.defineMIME("text/markdown", "markdown");
  
  CodeMirror.defineMIME("text/x-markdown", "markdown");
  
  });

  // CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
      mod(require("../../lib/codemirror"));
    else if (typeof define == "function" && define.amd) // AMD
      define(["../../lib/codemirror"], mod);
    else // Plain browser env
      mod(CodeMirror);
  })(function(CodeMirror) {
  "use strict";
  
  CodeMirror.defineMode('shell', function() {
  
    var words = {};
    function define(style, dict) {
      for(var i = 0; i < dict.length; i++) {
        words[dict[i]] = style;
      }
    };
  
    var commonAtoms = ["true", "false"];
    var commonKeywords = ["if", "then", "do", "else", "elif", "while", "until", "for", "in", "esac", "fi",
      "fin", "fil", "done", "exit", "set", "unset", "export", "function"];
    var commonCommands = ["ab", "awk", "bash", "beep", "cat", "cc", "cd", "chown", "chmod", "chroot", "clear",
      "cp", "curl", "cut", "diff", "echo", "find", "gawk", "gcc", "get", "git", "grep", "hg", "kill", "killall",
      "ln", "ls", "make", "mkdir", "openssl", "mv", "nc", "nl", "node", "npm", "ping", "ps", "restart", "rm",
      "rmdir", "sed", "service", "sh", "shopt", "shred", "source", "sort", "sleep", "ssh", "start", "stop",
      "su", "sudo", "svn", "tee", "telnet", "top", "touch", "vi", "vim", "wall", "wc", "wget", "who", "write",
      "yes", "zsh"];
  
    CodeMirror.registerHelper("hintWords", "shell", commonAtoms.concat(commonKeywords, commonCommands));
  
    define('atom', commonAtoms);
    define('keyword', commonKeywords);
    define('builtin', commonCommands);
  
    function tokenBase(stream, state) {
      if (stream.eatSpace()) return null;
  
      var sol = stream.sol();
      var ch = stream.next();
  
      if (ch === '\\') {
        stream.next();
        return null;
      }
      if (ch === '\'' || ch === '"' || ch === '`') {
        state.tokens.unshift(tokenString(ch, ch === "`" ? "quote" : "string"));
        return tokenize(stream, state);
      }
      if (ch === '#') {
        if (sol && stream.eat('!')) {
          stream.skipToEnd();
          return 'meta'; // 'comment'?
        }
        stream.skipToEnd();
        return 'comment';
      }
      if (ch === '$') {
        state.tokens.unshift(tokenDollar);
        return tokenize(stream, state);
      }
      if (ch === '+' || ch === '=') {
        return 'operator';
      }
      if (ch === '-') {
        stream.eat('-');
        stream.eatWhile(/\w/);
        return 'attribute';
      }
      if (/\d/.test(ch)) {
        stream.eatWhile(/\d/);
        if(stream.eol() || !/\w/.test(stream.peek())) {
          return 'number';
        }
      }
      stream.eatWhile(/[\w-]/);
      var cur = stream.current();
      if (stream.peek() === '=' && /\w+/.test(cur)) return 'def';
      return words.hasOwnProperty(cur) ? words[cur] : null;
    }
  
    function tokenString(quote, style) {
      var close = quote == "(" ? ")" : quote == "{" ? "}" : quote
      return function(stream, state) {
        var next, escaped = false;
        while ((next = stream.next()) != null) {
          if (next === close && !escaped) {
            state.tokens.shift();
            break;
          } else if (next === '$' && !escaped && quote !== "'" && stream.peek() != close) {
            escaped = true;
            stream.backUp(1);
            state.tokens.unshift(tokenDollar);
            break;
          } else if (!escaped && quote !== close && next === quote) {
            state.tokens.unshift(tokenString(quote, style))
            return tokenize(stream, state)
          } else if (!escaped && /['"]/.test(next) && !/['"]/.test(quote)) {
            state.tokens.unshift(tokenStringStart(next, "string"));
            stream.backUp(1);
            break;
          }
          escaped = !escaped && next === '\\';
        }
        return style;
      };
    };
  
    function tokenStringStart(quote, style) {
      return function(stream, state) {
        state.tokens[0] = tokenString(quote, style)
        stream.next()
        return tokenize(stream, state)
      }
    }
  
    var tokenDollar = function(stream, state) {
      if (state.tokens.length > 1) stream.eat('$');
      var ch = stream.next()
      if (/['"({]/.test(ch)) {
        state.tokens[0] = tokenString(ch, ch == "(" ? "quote" : ch == "{" ? "def" : "string");
        return tokenize(stream, state);
      }
      if (!/\d/.test(ch)) stream.eatWhile(/\w/);
      state.tokens.shift();
      return 'def';
    };
  
    function tokenize(stream, state) {
      return (state.tokens[0] || tokenBase) (stream, state);
    };
  
    return {
      startState: function() {return {tokens:[]};},
      token: function(stream, state) {
        return tokenize(stream, state);
      },
      closeBrackets: "()[]{}''\"\"``",
      lineComment: '#',
      fold: "brace"
    };
  });
  
  CodeMirror.defineMIME('text/x-sh', 'shell');
  // Apache uses a slightly different Media Type for Shell scripts
  // http://svn.apache.org/repos/asf/httpd/httpd/trunk/docs/conf/mime.types
  CodeMirror.defineMIME('application/x-sh', 'shell');
  
  });


  // CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
      mod(require("../../lib/codemirror"));
    else if (typeof define == "function" && define.amd) // AMD
      define(["../../lib/codemirror"], mod);
    else // Plain browser env
      mod(CodeMirror);
  })(function(CodeMirror) {
  "use strict";
  
  CodeMirror.defineMode("yaml", function() {
  
    var cons = ['true', 'false', 'on', 'off', 'yes', 'no'];
    var keywordRegex = new RegExp("\\b(("+cons.join(")|(")+"))$", 'i');
  
    return {
      token: function(stream, state) {
        var ch = stream.peek();
        var esc = state.escaped;
        state.escaped = false;
        /* comments */
        if (ch == "#" && (stream.pos == 0 || /\s/.test(stream.string.charAt(stream.pos - 1)))) {
          stream.skipToEnd();
          return "comment";
        }
  
        if (stream.match(/^('([^']|\\.)*'?|"([^"]|\\.)*"?)/))
          return "string";
  
        if (state.literal && stream.indentation() > state.keyCol) {
          stream.skipToEnd(); return "string";
        } else if (state.literal) { state.literal = false; }
        if (stream.sol()) {
          state.keyCol = 0;
          state.pair = false;
          state.pairStart = false;
          /* document start */
          if(stream.match(/---/)) { return "def"; }
          /* document end */
          if (stream.match(/\.\.\./)) { return "def"; }
          /* array list item */
          if (stream.match(/\s*-\s+/)) { return 'meta'; }
        }
        /* inline pairs/lists */
        if (stream.match(/^(\{|\}|\[|\])/)) {
          if (ch == '{')
            state.inlinePairs++;
          else if (ch == '}')
            state.inlinePairs--;
          else if (ch == '[')
            state.inlineList++;
          else
            state.inlineList--;
          return 'meta';
        }
  
        /* list seperator */
        if (state.inlineList > 0 && !esc && ch == ',') {
          stream.next();
          return 'meta';
        }
        /* pairs seperator */
        if (state.inlinePairs > 0 && !esc && ch == ',') {
          state.keyCol = 0;
          state.pair = false;
          state.pairStart = false;
          stream.next();
          return 'meta';
        }
  
        /* start of value of a pair */
        if (state.pairStart) {
          /* block literals */
          if (stream.match(/^\s*(\||\>)\s*/)) { state.literal = true; return 'meta'; };
          /* references */
          if (stream.match(/^\s*(\&|\*)[a-z0-9\._-]+\b/i)) { return 'variable-2'; }
          /* numbers */
          if (state.inlinePairs == 0 && stream.match(/^\s*-?[0-9\.\,]+\s?$/)) { return 'number'; }
          if (state.inlinePairs > 0 && stream.match(/^\s*-?[0-9\.\,]+\s?(?=(,|}))/)) { return 'number'; }
          /* keywords */
          if (stream.match(keywordRegex)) { return 'keyword'; }
        }
  
        /* pairs (associative arrays) -> key */
        if (!state.pair && stream.match(/^\s*(?:[,\[\]{}&*!|>'"%@`][^\s'":]|[^,\[\]{}#&*!|>'"%@`])[^#]*?(?=\s*:($|\s))/)) {
          state.pair = true;
          state.keyCol = stream.indentation();
          return "atom";
        }
        if (state.pair && stream.match(/^:\s*/)) { state.pairStart = true; return 'meta'; }
  
        /* nothing found, continue */
        state.pairStart = false;
        state.escaped = (ch == '\\');
        stream.next();
        return null;
      },
      startState: function() {
        return {
          pair: false,
          pairStart: false,
          keyCol: 0,
          inlinePairs: 0,
          inlineList: 0,
          literal: false,
          escaped: false
        };
      },
      lineComment: "#",
      fold: "indent"
    };
  });
  
  CodeMirror.defineMIME("text/x-yaml", "yaml");
  CodeMirror.defineMIME("text/yaml", "yaml");
  
  });


  // CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
      mod(require("../../lib/codemirror"));
    else if (typeof define == "function" && define.amd) // AMD
      define(["../../lib/codemirror"], mod);
    else // Plain browser env
      mod(CodeMirror);
  })(function(CodeMirror) {
    "use strict";
  
    function wordRegexp(words) {
      return new RegExp("^((" + words.join(")|(") + "))\\b");
    }
  
    var wordOperators = wordRegexp(["and", "or", "not", "is"]);
    var commonKeywords = ["as", "assert", "break", "class", "continue",
                          "def", "del", "elif", "else", "except", "finally",
                          "for", "from", "global", "if", "import",
                          "lambda", "pass", "raise", "return",
                          "try", "while", "with", "yield", "in"];
    var commonBuiltins = ["abs", "all", "any", "bin", "bool", "bytearray", "callable", "chr",
                          "classmethod", "compile", "complex", "delattr", "dict", "dir", "divmod",
                          "enumerate", "eval", "filter", "float", "format", "frozenset",
                          "getattr", "globals", "hasattr", "hash", "help", "hex", "id",
                          "input", "int", "isinstance", "issubclass", "iter", "len",
                          "list", "locals", "map", "max", "memoryview", "min", "next",
                          "object", "oct", "open", "ord", "pow", "property", "range",
                          "repr", "reversed", "round", "set", "setattr", "slice",
                          "sorted", "staticmethod", "str", "sum", "super", "tuple",
                          "type", "vars", "zip", "__import__", "NotImplemented",
                          "Ellipsis", "__debug__"];
    CodeMirror.registerHelper("hintWords", "python", commonKeywords.concat(commonBuiltins));
  
    function top(state) {
      return state.scopes[state.scopes.length - 1];
    }
  
    CodeMirror.defineMode("python", function(conf, parserConf) {
      var ERRORCLASS = "error";
  
      var delimiters = parserConf.delimiters || parserConf.singleDelimiters || /^[\(\)\[\]\{\}@,:`=;\.\\]/;
      //               (Backwards-compatibility with old, cumbersome config system)
      var operators = [parserConf.singleOperators, parserConf.doubleOperators, parserConf.doubleDelimiters, parserConf.tripleDelimiters,
                       parserConf.operators || /^([-+*/%\/&|^]=?|[<>=]+|\/\/=?|\*\*=?|!=|[~!@]|\.\.\.)/]
      for (var i = 0; i < operators.length; i++) if (!operators[i]) operators.splice(i--, 1)
  
      var hangingIndent = parserConf.hangingIndent || conf.indentUnit;
  
      var myKeywords = commonKeywords, myBuiltins = commonBuiltins;
      if (parserConf.extra_keywords != undefined)
        myKeywords = myKeywords.concat(parserConf.extra_keywords);
  
      if (parserConf.extra_builtins != undefined)
        myBuiltins = myBuiltins.concat(parserConf.extra_builtins);
  
      var py3 = !(parserConf.version && Number(parserConf.version) < 3)
      if (py3) {
        // since http://legacy.python.org/dev/peps/pep-0465/ @ is also an operator
        var identifiers = parserConf.identifiers|| /^[_A-Za-z\u00A1-\uFFFF][_A-Za-z0-9\u00A1-\uFFFF]*/;
        myKeywords = myKeywords.concat(["nonlocal", "False", "True", "None", "async", "await"]);
        myBuiltins = myBuiltins.concat(["ascii", "bytes", "exec", "print"]);
        var stringPrefixes = new RegExp("^(([rbuf]|(br)|(fr))?('{3}|\"{3}|['\"]))", "i");
      } else {
        var identifiers = parserConf.identifiers|| /^[_A-Za-z][_A-Za-z0-9]*/;
        myKeywords = myKeywords.concat(["exec", "print"]);
        myBuiltins = myBuiltins.concat(["apply", "basestring", "buffer", "cmp", "coerce", "execfile",
                                        "file", "intern", "long", "raw_input", "reduce", "reload",
                                        "unichr", "unicode", "xrange", "False", "True", "None"]);
        var stringPrefixes = new RegExp("^(([rubf]|(ur)|(br))?('{3}|\"{3}|['\"]))", "i");
      }
      var keywords = wordRegexp(myKeywords);
      var builtins = wordRegexp(myBuiltins);
  
      // tokenizers
      function tokenBase(stream, state) {
        var sol = stream.sol() && state.lastToken != "\\"
        if (sol) state.indent = stream.indentation()
        // Handle scope changes
        if (sol && top(state).type == "py") {
          var scopeOffset = top(state).offset;
          if (stream.eatSpace()) {
            var lineOffset = stream.indentation();
            if (lineOffset > scopeOffset)
              pushPyScope(state);
            else if (lineOffset < scopeOffset && dedent(stream, state) && stream.peek() != "#")
              state.errorToken = true;
            return null;
          } else {
            var style = tokenBaseInner(stream, state);
            if (scopeOffset > 0 && dedent(stream, state))
              style += " " + ERRORCLASS;
            return style;
          }
        }
        return tokenBaseInner(stream, state);
      }
  
      function tokenBaseInner(stream, state, inFormat) {
        if (stream.eatSpace()) return null;
  
        // Handle Comments
        if (!inFormat && stream.match(/^#.*/)) return "comment";
  
        // Handle Number Literals
        if (stream.match(/^[0-9\.]/, false)) {
          var floatLiteral = false;
          // Floats
          if (stream.match(/^[\d_]*\.\d+(e[\+\-]?\d+)?/i)) { floatLiteral = true; }
          if (stream.match(/^[\d_]+\.\d*/)) { floatLiteral = true; }
          if (stream.match(/^\.\d+/)) { floatLiteral = true; }
          if (floatLiteral) {
            // Float literals may be "imaginary"
            stream.eat(/J/i);
            return "number";
          }
          // Integers
          var intLiteral = false;
          // Hex
          if (stream.match(/^0x[0-9a-f_]+/i)) intLiteral = true;
          // Binary
          if (stream.match(/^0b[01_]+/i)) intLiteral = true;
          // Octal
          if (stream.match(/^0o[0-7_]+/i)) intLiteral = true;
          // Decimal
          if (stream.match(/^[1-9][\d_]*(e[\+\-]?[\d_]+)?/)) {
            // Decimal literals may be "imaginary"
            stream.eat(/J/i);
            // TODO - Can you have imaginary longs?
            intLiteral = true;
          }
          // Zero by itself with no other piece of number.
          if (stream.match(/^0(?![\dx])/i)) intLiteral = true;
          if (intLiteral) {
            // Integer literals may be "long"
            stream.eat(/L/i);
            return "number";
          }
        }
  
        // Handle Strings
        if (stream.match(stringPrefixes)) {
          var isFmtString = stream.current().toLowerCase().indexOf('f') !== -1;
          if (!isFmtString) {
            state.tokenize = tokenStringFactory(stream.current(), state.tokenize);
            return state.tokenize(stream, state);
          } else {
            state.tokenize = formatStringFactory(stream.current(), state.tokenize);
            return state.tokenize(stream, state);
          }
        }
  
        for (var i = 0; i < operators.length; i++)
          if (stream.match(operators[i])) return "operator"
  
        if (stream.match(delimiters)) return "punctuation";
  
        if (state.lastToken == "." && stream.match(identifiers))
          return "property";
  
        if (stream.match(keywords) || stream.match(wordOperators))
          return "keyword";
  
        if (stream.match(builtins))
          return "builtin";
  
        if (stream.match(/^(self|cls)\b/))
          return "variable-2";
  
        if (stream.match(identifiers)) {
          if (state.lastToken == "def" || state.lastToken == "class")
            return "def";
          return "variable";
        }
  
        // Handle non-detected items
        stream.next();
        return inFormat ? null :ERRORCLASS;
      }
  
      function formatStringFactory(delimiter, tokenOuter) {
        while ("rubf".indexOf(delimiter.charAt(0).toLowerCase()) >= 0)
          delimiter = delimiter.substr(1);
  
        var singleline = delimiter.length == 1;
        var OUTCLASS = "string";
  
        function tokenNestedExpr(depth) {
          return function(stream, state) {
            var inner = tokenBaseInner(stream, state, true)
            if (inner == "punctuation") {
              if (stream.current() == "{") {
                state.tokenize = tokenNestedExpr(depth + 1)
              } else if (stream.current() == "}") {
                if (depth > 1) state.tokenize = tokenNestedExpr(depth - 1)
                else state.tokenize = tokenString
              }
            }
            return inner
          }
        }
  
        function tokenString(stream, state) {
          while (!stream.eol()) {
            stream.eatWhile(/[^'"\{\}\\]/);
            if (stream.eat("\\")) {
              stream.next();
              if (singleline && stream.eol())
                return OUTCLASS;
            } else if (stream.match(delimiter)) {
              state.tokenize = tokenOuter;
              return OUTCLASS;
            } else if (stream.match('{{')) {
              // ignore {{ in f-str
              return OUTCLASS;
            } else if (stream.match('{', false)) {
              // switch to nested mode
              state.tokenize = tokenNestedExpr(0)
              if (stream.current()) return OUTCLASS;
              else return state.tokenize(stream, state)
            } else if (stream.match('}}')) {
              return OUTCLASS;
            } else if (stream.match('}')) {
              // single } in f-string is an error
              return ERRORCLASS;
            } else {
              stream.eat(/['"]/);
            }
          }
          if (singleline) {
            if (parserConf.singleLineStringErrors)
              return ERRORCLASS;
            else
              state.tokenize = tokenOuter;
          }
          return OUTCLASS;
        }
        tokenString.isString = true;
        return tokenString;
      }
  
      function tokenStringFactory(delimiter, tokenOuter) {
        while ("rubf".indexOf(delimiter.charAt(0).toLowerCase()) >= 0)
          delimiter = delimiter.substr(1);
  
        var singleline = delimiter.length == 1;
        var OUTCLASS = "string";
  
        function tokenString(stream, state) {
          while (!stream.eol()) {
            stream.eatWhile(/[^'"\\]/);
            if (stream.eat("\\")) {
              stream.next();
              if (singleline && stream.eol())
                return OUTCLASS;
            } else if (stream.match(delimiter)) {
              state.tokenize = tokenOuter;
              return OUTCLASS;
            } else {
              stream.eat(/['"]/);
            }
          }
          if (singleline) {
            if (parserConf.singleLineStringErrors)
              return ERRORCLASS;
            else
              state.tokenize = tokenOuter;
          }
          return OUTCLASS;
        }
        tokenString.isString = true;
        return tokenString;
      }
  
      function pushPyScope(state) {
        while (top(state).type != "py") state.scopes.pop()
        state.scopes.push({offset: top(state).offset + conf.indentUnit,
                           type: "py",
                           align: null})
      }
  
      function pushBracketScope(stream, state, type) {
        var align = stream.match(/^([\s\[\{\(]|#.*)*$/, false) ? null : stream.column() + 1
        state.scopes.push({offset: state.indent + hangingIndent,
                           type: type,
                           align: align})
      }
  
      function dedent(stream, state) {
        var indented = stream.indentation();
        while (state.scopes.length > 1 && top(state).offset > indented) {
          if (top(state).type != "py") return true;
          state.scopes.pop();
        }
        return top(state).offset != indented;
      }
  
      function tokenLexer(stream, state) {
        if (stream.sol()) state.beginningOfLine = true;
  
        var style = state.tokenize(stream, state);
        var current = stream.current();
  
        // Handle decorators
        if (state.beginningOfLine && current == "@")
          return stream.match(identifiers, false) ? "meta" : py3 ? "operator" : ERRORCLASS;
  
        if (/\S/.test(current)) state.beginningOfLine = false;
  
        if ((style == "variable" || style == "builtin")
            && state.lastToken == "meta")
          style = "meta";
  
        // Handle scope changes.
        if (current == "pass" || current == "return")
          state.dedent += 1;
  
        if (current == "lambda") state.lambda = true;
        if (current == ":" && !state.lambda && top(state).type == "py")
          pushPyScope(state);
  
        if (current.length == 1 && !/string|comment/.test(style)) {
          var delimiter_index = "[({".indexOf(current);
          if (delimiter_index != -1)
            pushBracketScope(stream, state, "])}".slice(delimiter_index, delimiter_index+1));
  
          delimiter_index = "])}".indexOf(current);
          if (delimiter_index != -1) {
            if (top(state).type == current) state.indent = state.scopes.pop().offset - hangingIndent
            else return ERRORCLASS;
          }
        }
        if (state.dedent > 0 && stream.eol() && top(state).type == "py") {
          if (state.scopes.length > 1) state.scopes.pop();
          state.dedent -= 1;
        }
  
        return style;
      }
  
      var external = {
        startState: function(basecolumn) {
          return {
            tokenize: tokenBase,
            scopes: [{offset: basecolumn || 0, type: "py", align: null}],
            indent: basecolumn || 0,
            lastToken: null,
            lambda: false,
            dedent: 0
          };
        },
  
        token: function(stream, state) {
          var addErr = state.errorToken;
          if (addErr) state.errorToken = false;
          var style = tokenLexer(stream, state);
  
          if (style && style != "comment")
            state.lastToken = (style == "keyword" || style == "punctuation") ? stream.current() : style;
          if (style == "punctuation") style = null;
  
          if (stream.eol() && state.lambda)
            state.lambda = false;
          return addErr ? style + " " + ERRORCLASS : style;
        },
  
        indent: function(state, textAfter) {
          if (state.tokenize != tokenBase)
            return state.tokenize.isString ? CodeMirror.Pass : 0;
  
          var scope = top(state), closing = scope.type == textAfter.charAt(0)
          if (scope.align != null)
            return scope.align - (closing ? 1 : 0)
          else
            return scope.offset - (closing ? hangingIndent : 0)
        },
  
        electricInput: /^\s*[\}\]\)]$/,
        closeBrackets: {triples: "'\""},
        lineComment: "#",
        fold: "indent"
      };
      return external;
    });
  
    CodeMirror.defineMIME("text/x-python", "python");
  
    var words = function(str) { return str.split(" "); };
  
    CodeMirror.defineMIME("text/x-cython", {
      name: "python",
      extra_keywords: words("by cdef cimport cpdef ctypedef enum except "+
                            "extern gil include nogil property public "+
                            "readonly struct union DEF IF ELIF ELSE")
    });
  
  });

  // CodeMirror, copyright (c) by Marijn Haverbeke and others
// Distributed under an MIT license: https://codemirror.net/LICENSE

(function(mod) {
    if (typeof exports == "object" && typeof module == "object") // CommonJS
      mod(require("../../lib/codemirror"));
    else if (typeof define == "function" && define.amd) // AMD
      define(["../../lib/codemirror"], mod);
    else // Plain browser env
      mod(CodeMirror);
  })(function(CodeMirror) {
  "use strict";
  
  function Context(indented, column, type, info, align, prev) {
    this.indented = indented;
    this.column = column;
    this.type = type;
    this.info = info;
    this.align = align;
    this.prev = prev;
  }
  function pushContext(state, col, type, info) {
    var indent = state.indented;
    if (state.context && state.context.type == "statement" && type != "statement")
      indent = state.context.indented;
    return state.context = new Context(indent, col, type, info, null, state.context);
  }
  function popContext(state) {
    var t = state.context.type;
    if (t == ")" || t == "]" || t == "}")
      state.indented = state.context.indented;
    return state.context = state.context.prev;
  }
  
  function typeBefore(stream, state, pos) {
    if (state.prevToken == "variable" || state.prevToken == "type") return true;
    if (/\S(?:[^- ]>|[*\]])\s*$|\*$/.test(stream.string.slice(0, pos))) return true;
    if (state.typeAtEndOfLine && stream.column() == stream.indentation()) return true;
  }
  
  function isTopScope(context) {
    for (;;) {
      if (!context || context.type == "top") return true;
      if (context.type == "}" && context.prev.info != "namespace") return false;
      context = context.prev;
    }
  }
  
  CodeMirror.defineMode("clike", function(config, parserConfig) {
    var indentUnit = config.indentUnit,
        statementIndentUnit = parserConfig.statementIndentUnit || indentUnit,
        dontAlignCalls = parserConfig.dontAlignCalls,
        keywords = parserConfig.keywords || {},
        types = parserConfig.types || {},
        builtin = parserConfig.builtin || {},
        blockKeywords = parserConfig.blockKeywords || {},
        defKeywords = parserConfig.defKeywords || {},
        atoms = parserConfig.atoms || {},
        hooks = parserConfig.hooks || {},
        multiLineStrings = parserConfig.multiLineStrings,
        indentStatements = parserConfig.indentStatements !== false,
        indentSwitch = parserConfig.indentSwitch !== false,
        namespaceSeparator = parserConfig.namespaceSeparator,
        isPunctuationChar = parserConfig.isPunctuationChar || /[\[\]{}\(\),;\:\.]/,
        numberStart = parserConfig.numberStart || /[\d\.]/,
        number = parserConfig.number || /^(?:0x[a-f\d]+|0b[01]+|(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)(u|ll?|l|f)?/i,
        isOperatorChar = parserConfig.isOperatorChar || /[+\-*&%=<>!?|\/]/,
        isIdentifierChar = parserConfig.isIdentifierChar || /[\w\$_\xa1-\uffff]/,
        // An optional function that takes a {string} token and returns true if it
        // should be treated as a builtin.
        isReservedIdentifier = parserConfig.isReservedIdentifier || false;
  
    var curPunc, isDefKeyword;
  
    function tokenBase(stream, state) {
      var ch = stream.next();
      if (hooks[ch]) {
        var result = hooks[ch](stream, state);
        if (result !== false) return result;
      }
      if (ch == '"' || ch == "'") {
        state.tokenize = tokenString(ch);
        return state.tokenize(stream, state);
      }
      if (isPunctuationChar.test(ch)) {
        curPunc = ch;
        return null;
      }
      if (numberStart.test(ch)) {
        stream.backUp(1)
        if (stream.match(number)) return "number"
        stream.next()
      }
      if (ch == "/") {
        if (stream.eat("*")) {
          state.tokenize = tokenComment;
          return tokenComment(stream, state);
        }
        if (stream.eat("/")) {
          stream.skipToEnd();
          return "comment";
        }
      }
      if (isOperatorChar.test(ch)) {
        while (!stream.match(/^\/[\/*]/, false) && stream.eat(isOperatorChar)) {}
        return "operator";
      }
      stream.eatWhile(isIdentifierChar);
      if (namespaceSeparator) while (stream.match(namespaceSeparator))
        stream.eatWhile(isIdentifierChar);
  
      var cur = stream.current();
      if (contains(keywords, cur)) {
        if (contains(blockKeywords, cur)) curPunc = "newstatement";
        if (contains(defKeywords, cur)) isDefKeyword = true;
        return "keyword";
      }
      if (contains(types, cur)) return "type";
      if (contains(builtin, cur)
          || (isReservedIdentifier && isReservedIdentifier(cur))) {
        if (contains(blockKeywords, cur)) curPunc = "newstatement";
        return "builtin";
      }
      if (contains(atoms, cur)) return "atom";
      return "variable";
    }
  
    function tokenString(quote) {
      return function(stream, state) {
        var escaped = false, next, end = false;
        while ((next = stream.next()) != null) {
          if (next == quote && !escaped) {end = true; break;}
          escaped = !escaped && next == "\\";
        }
        if (end || !(escaped || multiLineStrings))
          state.tokenize = null;
        return "string";
      };
    }
  
    function tokenComment(stream, state) {
      var maybeEnd = false, ch;
      while (ch = stream.next()) {
        if (ch == "/" && maybeEnd) {
          state.tokenize = null;
          break;
        }
        maybeEnd = (ch == "*");
      }
      return "comment";
    }
  
    function maybeEOL(stream, state) {
      if (parserConfig.typeFirstDefinitions && stream.eol() && isTopScope(state.context))
        state.typeAtEndOfLine = typeBefore(stream, state, stream.pos)
    }
  
    // Interface
  
    return {
      startState: function(basecolumn) {
        return {
          tokenize: null,
          context: new Context((basecolumn || 0) - indentUnit, 0, "top", null, false),
          indented: 0,
          startOfLine: true,
          prevToken: null
        };
      },
  
      token: function(stream, state) {
        var ctx = state.context;
        if (stream.sol()) {
          if (ctx.align == null) ctx.align = false;
          state.indented = stream.indentation();
          state.startOfLine = true;
        }
        if (stream.eatSpace()) { maybeEOL(stream, state); return null; }
        curPunc = isDefKeyword = null;
        var style = (state.tokenize || tokenBase)(stream, state);
        if (style == "comment" || style == "meta") return style;
        if (ctx.align == null) ctx.align = true;
  
        if (curPunc == ";" || curPunc == ":" || (curPunc == "," && stream.match(/^\s*(?:\/\/.*)?$/, false)))
          while (state.context.type == "statement") popContext(state);
        else if (curPunc == "{") pushContext(state, stream.column(), "}");
        else if (curPunc == "[") pushContext(state, stream.column(), "]");
        else if (curPunc == "(") pushContext(state, stream.column(), ")");
        else if (curPunc == "}") {
          while (ctx.type == "statement") ctx = popContext(state);
          if (ctx.type == "}") ctx = popContext(state);
          while (ctx.type == "statement") ctx = popContext(state);
        }
        else if (curPunc == ctx.type) popContext(state);
        else if (indentStatements &&
                 (((ctx.type == "}" || ctx.type == "top") && curPunc != ";") ||
                  (ctx.type == "statement" && curPunc == "newstatement"))) {
          pushContext(state, stream.column(), "statement", stream.current());
        }
  
        if (style == "variable" &&
            ((state.prevToken == "def" ||
              (parserConfig.typeFirstDefinitions && typeBefore(stream, state, stream.start) &&
               isTopScope(state.context) && stream.match(/^\s*\(/, false)))))
          style = "def";
  
        if (hooks.token) {
          var result = hooks.token(stream, state, style);
          if (result !== undefined) style = result;
        }
  
        if (style == "def" && parserConfig.styleDefs === false) style = "variable";
  
        state.startOfLine = false;
        state.prevToken = isDefKeyword ? "def" : style || curPunc;
        maybeEOL(stream, state);
        return style;
      },
  
      indent: function(state, textAfter) {
        if (state.tokenize != tokenBase && state.tokenize != null || state.typeAtEndOfLine) return CodeMirror.Pass;
        var ctx = state.context, firstChar = textAfter && textAfter.charAt(0);
        var closing = firstChar == ctx.type;
        if (ctx.type == "statement" && firstChar == "}") ctx = ctx.prev;
        if (parserConfig.dontIndentStatements)
          while (ctx.type == "statement" && parserConfig.dontIndentStatements.test(ctx.info))
            ctx = ctx.prev
        if (hooks.indent) {
          var hook = hooks.indent(state, ctx, textAfter, indentUnit);
          if (typeof hook == "number") return hook
        }
        var switchBlock = ctx.prev && ctx.prev.info == "switch";
        if (parserConfig.allmanIndentation && /[{(]/.test(firstChar)) {
          while (ctx.type != "top" && ctx.type != "}") ctx = ctx.prev
          return ctx.indented
        }
        if (ctx.type == "statement")
          return ctx.indented + (firstChar == "{" ? 0 : statementIndentUnit);
        if (ctx.align && (!dontAlignCalls || ctx.type != ")"))
          return ctx.column + (closing ? 0 : 1);
        if (ctx.type == ")" && !closing)
          return ctx.indented + statementIndentUnit;
  
        return ctx.indented + (closing ? 0 : indentUnit) +
          (!closing && switchBlock && !/^(?:case|default)\b/.test(textAfter) ? indentUnit : 0);
      },
  
      electricInput: indentSwitch ? /^\s*(?:case .*?:|default:|\{\}?|\})$/ : /^\s*[{}]$/,
      blockCommentStart: "/*",
      blockCommentEnd: "*/",
      blockCommentContinue: " * ",
      lineComment: "//",
      fold: "brace"
    };
  });
  
    function words(str) {
      var obj = {}, words = str.split(" ");
      for (var i = 0; i < words.length; ++i) obj[words[i]] = true;
      return obj;
    }
    function contains(words, word) {
      if (typeof words === "function") {
        return words(word);
      } else {
        return words.propertyIsEnumerable(word);
      }
    }
    var cKeywords = "auto if break case register continue return default do sizeof " +
      "static else struct switch extern typedef union for goto while enum const " +
      "volatile inline restrict asm fortran";
  
    // Keywords from https://en.cppreference.com/w/cpp/keyword includes C++20.
    var cppKeywords = "alignas alignof and and_eq audit axiom bitand bitor catch " +
    "class compl concept constexpr const_cast decltype delete dynamic_cast " +
    "explicit export final friend import module mutable namespace new noexcept " +
    "not not_eq operator or or_eq override private protected public " +
    "reinterpret_cast requires static_assert static_cast template this " +
    "thread_local throw try typeid typename using virtual xor xor_eq";
  
    var objCKeywords = "bycopy byref in inout oneway out self super atomic nonatomic retain copy " +
    "readwrite readonly strong weak assign typeof nullable nonnull null_resettable _cmd " +
    "@interface @implementation @end @protocol @encode @property @synthesize @dynamic @class " +
    "@public @package @private @protected @required @optional @try @catch @finally @import " +
    "@selector @encode @defs @synchronized @autoreleasepool @compatibility_alias @available";
  
    var objCBuiltins = "FOUNDATION_EXPORT FOUNDATION_EXTERN NS_INLINE NS_FORMAT_FUNCTION " +
    " NS_RETURNS_RETAINEDNS_ERROR_ENUM NS_RETURNS_NOT_RETAINED NS_RETURNS_INNER_POINTER " +
    "NS_DESIGNATED_INITIALIZER NS_ENUM NS_OPTIONS NS_REQUIRES_NIL_TERMINATION " +
    "NS_ASSUME_NONNULL_BEGIN NS_ASSUME_NONNULL_END NS_SWIFT_NAME NS_REFINED_FOR_SWIFT"
  
    // Do not use this. Use the cTypes function below. This is global just to avoid
    // excessive calls when cTypes is being called multiple times during a parse.
    var basicCTypes = words("int long char short double float unsigned signed " +
      "void bool");
  
    // Do not use this. Use the objCTypes function below. This is global just to avoid
    // excessive calls when objCTypes is being called multiple times during a parse.
    var basicObjCTypes = words("SEL instancetype id Class Protocol BOOL");
  
    // Returns true if identifier is a "C" type.
    // C type is defined as those that are reserved by the compiler (basicTypes),
    // and those that end in _t (Reserved by POSIX for types)
    // http://www.gnu.org/software/libc/manual/html_node/Reserved-Names.html
    function cTypes(identifier) {
      return contains(basicCTypes, identifier) || /.+_t$/.test(identifier);
    }
  
    // Returns true if identifier is a "Objective C" type.
    function objCTypes(identifier) {
      return cTypes(identifier) || contains(basicObjCTypes, identifier);
    }
  
    var cBlockKeywords = "case do else for if switch while struct enum union";
    var cDefKeywords = "struct enum union";
  
    function cppHook(stream, state) {
      if (!state.startOfLine) return false
      for (var ch, next = null; ch = stream.peek();) {
        if (ch == "\\" && stream.match(/^.$/)) {
          next = cppHook
          break
        } else if (ch == "/" && stream.match(/^\/[\/\*]/, false)) {
          break
        }
        stream.next()
      }
      state.tokenize = next
      return "meta"
    }
  
    function pointerHook(_stream, state) {
      if (state.prevToken == "type") return "type";
      return false;
    }
  
    // For C and C++ (and ObjC): identifiers starting with __
    // or _ followed by a capital letter are reserved for the compiler.
    function cIsReservedIdentifier(token) {
      if (!token || token.length < 2) return false;
      if (token[0] != '_') return false;
      return (token[1] == '_') || (token[1] !== token[1].toLowerCase());
    }
  
    function cpp14Literal(stream) {
      stream.eatWhile(/[\w\.']/);
      return "number";
    }
  
    function cpp11StringHook(stream, state) {
      stream.backUp(1);
      // Raw strings.
      if (stream.match(/(R|u8R|uR|UR|LR)/)) {
        var match = stream.match(/"([^\s\\()]{0,16})\(/);
        if (!match) {
          return false;
        }
        state.cpp11RawStringDelim = match[1];
        state.tokenize = tokenRawString;
        return tokenRawString(stream, state);
      }
      // Unicode strings/chars.
      if (stream.match(/(u8|u|U|L)/)) {
        if (stream.match(/["']/, /* eat */ false)) {
          return "string";
        }
        return false;
      }
      // Ignore this hook.
      stream.next();
      return false;
    }
  
    function cppLooksLikeConstructor(word) {
      var lastTwo = /(\w+)::~?(\w+)$/.exec(word);
      return lastTwo && lastTwo[1] == lastTwo[2];
    }
  
    // C#-style strings where "" escapes a quote.
    function tokenAtString(stream, state) {
      var next;
      while ((next = stream.next()) != null) {
        if (next == '"' && !stream.eat('"')) {
          state.tokenize = null;
          break;
        }
      }
      return "string";
    }
  
    // C++11 raw string literal is <prefix>"<delim>( anything )<delim>", where
    // <delim> can be a string up to 16 characters long.
    function tokenRawString(stream, state) {
      // Escape characters that have special regex meanings.
      var delim = state.cpp11RawStringDelim.replace(/[^\w\s]/g, '\\$&');
      var match = stream.match(new RegExp(".*?\\)" + delim + '"'));
      if (match)
        state.tokenize = null;
      else
        stream.skipToEnd();
      return "string";
    }
  
    function def(mimes, mode) {
      if (typeof mimes == "string") mimes = [mimes];
      var words = [];
      function add(obj) {
        if (obj) for (var prop in obj) if (obj.hasOwnProperty(prop))
          words.push(prop);
      }
      add(mode.keywords);
      add(mode.types);
      add(mode.builtin);
      add(mode.atoms);
      if (words.length) {
        mode.helperType = mimes[0];
        CodeMirror.registerHelper("hintWords", mimes[0], words);
      }
  
      for (var i = 0; i < mimes.length; ++i)
        CodeMirror.defineMIME(mimes[i], mode);
    }
  
    def(["text/x-csrc", "text/x-c", "text/x-chdr"], {
      name: "clike",
      keywords: words(cKeywords),
      types: cTypes,
      blockKeywords: words(cBlockKeywords),
      defKeywords: words(cDefKeywords),
      typeFirstDefinitions: true,
      atoms: words("NULL true false"),
      isReservedIdentifier: cIsReservedIdentifier,
      hooks: {
        "#": cppHook,
        "*": pointerHook,
      },
      modeProps: {fold: ["brace", "include"]}
    });
  
    def(["text/x-c++src", "text/x-c++hdr"], {
      name: "clike",
      keywords: words(cKeywords + " " + cppKeywords),
      types: cTypes,
      blockKeywords: words(cBlockKeywords + " class try catch"),
      defKeywords: words(cDefKeywords + " class namespace"),
      typeFirstDefinitions: true,
      atoms: words("true false NULL nullptr"),
      dontIndentStatements: /^template$/,
      isIdentifierChar: /[\w\$_~\xa1-\uffff]/,
      isReservedIdentifier: cIsReservedIdentifier,
      hooks: {
        "#": cppHook,
        "*": pointerHook,
        "u": cpp11StringHook,
        "U": cpp11StringHook,
        "L": cpp11StringHook,
        "R": cpp11StringHook,
        "0": cpp14Literal,
        "1": cpp14Literal,
        "2": cpp14Literal,
        "3": cpp14Literal,
        "4": cpp14Literal,
        "5": cpp14Literal,
        "6": cpp14Literal,
        "7": cpp14Literal,
        "8": cpp14Literal,
        "9": cpp14Literal,
        token: function(stream, state, style) {
          if (style == "variable" && stream.peek() == "(" &&
              (state.prevToken == ";" || state.prevToken == null ||
               state.prevToken == "}") &&
              cppLooksLikeConstructor(stream.current()))
            return "def";
        }
      },
      namespaceSeparator: "::",
      modeProps: {fold: ["brace", "include"]}
    });
  
    def("text/x-java", {
      name: "clike",
      keywords: words("abstract assert break case catch class const continue default " +
                      "do else enum extends final finally for goto if implements import " +
                      "instanceof interface native new package private protected public " +
                      "return static strictfp super switch synchronized this throw throws transient " +
                      "try volatile while @interface"),
      types: words("byte short int long float double boolean char void Boolean Byte Character Double Float " +
                   "Integer Long Number Object Short String StringBuffer StringBuilder Void"),
      blockKeywords: words("catch class do else finally for if switch try while"),
      defKeywords: words("class interface enum @interface"),
      typeFirstDefinitions: true,
      atoms: words("true false null"),
      number: /^(?:0x[a-f\d_]+|0b[01_]+|(?:[\d_]+\.?\d*|\.\d+)(?:e[-+]?[\d_]+)?)(u|ll?|l|f)?/i,
      hooks: {
        "@": function(stream) {
          // Don't match the @interface keyword.
          if (stream.match('interface', false)) return false;
  
          stream.eatWhile(/[\w\$_]/);
          return "meta";
        }
      },
      modeProps: {fold: ["brace", "import"]}
    });
  
    def("text/x-csharp", {
      name: "clike",
      keywords: words("abstract as async await base break case catch checked class const continue" +
                      " default delegate do else enum event explicit extern finally fixed for" +
                      " foreach goto if implicit in interface internal is lock namespace new" +
                      " operator out override params private protected public readonly ref return sealed" +
                      " sizeof stackalloc static struct switch this throw try typeof unchecked" +
                      " unsafe using virtual void volatile while add alias ascending descending dynamic from get" +
                      " global group into join let orderby partial remove select set value var yield"),
      types: words("Action Boolean Byte Char DateTime DateTimeOffset Decimal Double Func" +
                   " Guid Int16 Int32 Int64 Object SByte Single String Task TimeSpan UInt16 UInt32" +
                   " UInt64 bool byte char decimal double short int long object"  +
                   " sbyte float string ushort uint ulong"),
      blockKeywords: words("catch class do else finally for foreach if struct switch try while"),
      defKeywords: words("class interface namespace struct var"),
      typeFirstDefinitions: true,
      atoms: words("true false null"),
      hooks: {
        "@": function(stream, state) {
          if (stream.eat('"')) {
            state.tokenize = tokenAtString;
            return tokenAtString(stream, state);
          }
          stream.eatWhile(/[\w\$_]/);
          return "meta";
        }
      }
    });
  
    function tokenTripleString(stream, state) {
      var escaped = false;
      while (!stream.eol()) {
        if (!escaped && stream.match('"""')) {
          state.tokenize = null;
          break;
        }
        escaped = stream.next() == "\\" && !escaped;
      }
      return "string";
    }
  
    function tokenNestedComment(depth) {
      return function (stream, state) {
        var ch
        while (ch = stream.next()) {
          if (ch == "*" && stream.eat("/")) {
            if (depth == 1) {
              state.tokenize = null
              break
            } else {
              state.tokenize = tokenNestedComment(depth - 1)
              return state.tokenize(stream, state)
            }
          } else if (ch == "/" && stream.eat("*")) {
            state.tokenize = tokenNestedComment(depth + 1)
            return state.tokenize(stream, state)
          }
        }
        return "comment"
      }
    }
  
    def("text/x-scala", {
      name: "clike",
      keywords: words(
        /* scala */
        "abstract case catch class def do else extends final finally for forSome if " +
        "implicit import lazy match new null object override package private protected return " +
        "sealed super this throw trait try type val var while with yield _ " +
  
        /* package scala */
        "assert assume require print println printf readLine readBoolean readByte readShort " +
        "readChar readInt readLong readFloat readDouble"
      ),
      types: words(
        "AnyVal App Application Array BufferedIterator BigDecimal BigInt Char Console Either " +
        "Enumeration Equiv Error Exception Fractional Function IndexedSeq Int Integral Iterable " +
        "Iterator List Map Numeric Nil NotNull Option Ordered Ordering PartialFunction PartialOrdering " +
        "Product Proxy Range Responder Seq Serializable Set Specializable Stream StringBuilder " +
        "StringContext Symbol Throwable Traversable TraversableOnce Tuple Unit Vector " +
  
        /* package java.lang */
        "Boolean Byte Character CharSequence Class ClassLoader Cloneable Comparable " +
        "Compiler Double Exception Float Integer Long Math Number Object Package Pair Process " +
        "Runtime Runnable SecurityManager Short StackTraceElement StrictMath String " +
        "StringBuffer System Thread ThreadGroup ThreadLocal Throwable Triple Void"
      ),
      multiLineStrings: true,
      blockKeywords: words("catch class enum do else finally for forSome if match switch try while"),
      defKeywords: words("class enum def object package trait type val var"),
      atoms: words("true false null"),
      indentStatements: false,
      indentSwitch: false,
      isOperatorChar: /[+\-*&%=<>!?|\/#:@]/,
      hooks: {
        "@": function(stream) {
          stream.eatWhile(/[\w\$_]/);
          return "meta";
        },
        '"': function(stream, state) {
          if (!stream.match('""')) return false;
          state.tokenize = tokenTripleString;
          return state.tokenize(stream, state);
        },
        "'": function(stream) {
          stream.eatWhile(/[\w\$_\xa1-\uffff]/);
          return "atom";
        },
        "=": function(stream, state) {
          var cx = state.context
          if (cx.type == "}" && cx.align && stream.eat(">")) {
            state.context = new Context(cx.indented, cx.column, cx.type, cx.info, null, cx.prev)
            return "operator"
          } else {
            return false
          }
        },
  
        "/": function(stream, state) {
          if (!stream.eat("*")) return false
          state.tokenize = tokenNestedComment(1)
          return state.tokenize(stream, state)
        }
      },
      modeProps: {closeBrackets: {pairs: '()[]{}""', triples: '"'}}
    });
  
    function tokenKotlinString(tripleString){
      return function (stream, state) {
        var escaped = false, next, end = false;
        while (!stream.eol()) {
          if (!tripleString && !escaped && stream.match('"') ) {end = true; break;}
          if (tripleString && stream.match('"""')) {end = true; break;}
          next = stream.next();
          if(!escaped && next == "$" && stream.match('{'))
            stream.skipTo("}");
          escaped = !escaped && next == "\\" && !tripleString;
        }
        if (end || !tripleString)
          state.tokenize = null;
        return "string";
      }
    }
  
    def("text/x-kotlin", {
      name: "clike",
      keywords: words(
        /*keywords*/
        "package as typealias class interface this super val operator " +
        "var fun for is in This throw return annotation " +
        "break continue object if else while do try when !in !is as? " +
  
        /*soft keywords*/
        "file import where by get set abstract enum open inner override private public internal " +
        "protected catch finally out final vararg reified dynamic companion constructor init " +
        "sealed field property receiver param sparam lateinit data inline noinline tailrec " +
        "external annotation crossinline const operator infix suspend actual expect setparam"
      ),
      types: words(
        /* package java.lang */
        "Boolean Byte Character CharSequence Class ClassLoader Cloneable Comparable " +
        "Compiler Double Exception Float Integer Long Math Number Object Package Pair Process " +
        "Runtime Runnable SecurityManager Short StackTraceElement StrictMath String " +
        "StringBuffer System Thread ThreadGroup ThreadLocal Throwable Triple Void Annotation Any BooleanArray " +
        "ByteArray Char CharArray DeprecationLevel DoubleArray Enum FloatArray Function Int IntArray Lazy " +
        "LazyThreadSafetyMode LongArray Nothing ShortArray Unit"
      ),
      intendSwitch: false,
      indentStatements: false,
      multiLineStrings: true,
      number: /^(?:0x[a-f\d_]+|0b[01_]+|(?:[\d_]+(\.\d+)?|\.\d+)(?:e[-+]?[\d_]+)?)(u|ll?|l|f)?/i,
      blockKeywords: words("catch class do else finally for if where try while enum"),
      defKeywords: words("class val var object interface fun"),
      atoms: words("true false null this"),
      hooks: {
        "@": function(stream) {
          stream.eatWhile(/[\w\$_]/);
          return "meta";
        },
        '*': function(_stream, state) {
          return state.prevToken == '.' ? 'variable' : 'operator';
        },
        '"': function(stream, state) {
          state.tokenize = tokenKotlinString(stream.match('""'));
          return state.tokenize(stream, state);
        },
        "/": function(stream, state) {
          if (!stream.eat("*")) return false;
          state.tokenize = tokenNestedComment(1);
          return state.tokenize(stream, state)
        },
        indent: function(state, ctx, textAfter, indentUnit) {
          var firstChar = textAfter && textAfter.charAt(0);
          if ((state.prevToken == "}" || state.prevToken == ")") && textAfter == "")
            return state.indented;
          if ((state.prevToken == "operator" && textAfter != "}" && state.context.type != "}") ||
            state.prevToken == "variable" && firstChar == "." ||
            (state.prevToken == "}" || state.prevToken == ")") && firstChar == ".")
            return indentUnit * 2 + ctx.indented;
          if (ctx.align && ctx.type == "}")
            return ctx.indented + (state.context.type == (textAfter || "").charAt(0) ? 0 : indentUnit);
        }
      },
      modeProps: {closeBrackets: {triples: '"'}}
    });
  
    def(["x-shader/x-vertex", "x-shader/x-fragment"], {
      name: "clike",
      keywords: words("sampler1D sampler2D sampler3D samplerCube " +
                      "sampler1DShadow sampler2DShadow " +
                      "const attribute uniform varying " +
                      "break continue discard return " +
                      "for while do if else struct " +
                      "in out inout"),
      types: words("float int bool void " +
                   "vec2 vec3 vec4 ivec2 ivec3 ivec4 bvec2 bvec3 bvec4 " +
                   "mat2 mat3 mat4"),
      blockKeywords: words("for while do if else struct"),
      builtin: words("radians degrees sin cos tan asin acos atan " +
                      "pow exp log exp2 sqrt inversesqrt " +
                      "abs sign floor ceil fract mod min max clamp mix step smoothstep " +
                      "length distance dot cross normalize ftransform faceforward " +
                      "reflect refract matrixCompMult " +
                      "lessThan lessThanEqual greaterThan greaterThanEqual " +
                      "equal notEqual any all not " +
                      "texture1D texture1DProj texture1DLod texture1DProjLod " +
                      "texture2D texture2DProj texture2DLod texture2DProjLod " +
                      "texture3D texture3DProj texture3DLod texture3DProjLod " +
                      "textureCube textureCubeLod " +
                      "shadow1D shadow2D shadow1DProj shadow2DProj " +
                      "shadow1DLod shadow2DLod shadow1DProjLod shadow2DProjLod " +
                      "dFdx dFdy fwidth " +
                      "noise1 noise2 noise3 noise4"),
      atoms: words("true false " +
                  "gl_FragColor gl_SecondaryColor gl_Normal gl_Vertex " +
                  "gl_MultiTexCoord0 gl_MultiTexCoord1 gl_MultiTexCoord2 gl_MultiTexCoord3 " +
                  "gl_MultiTexCoord4 gl_MultiTexCoord5 gl_MultiTexCoord6 gl_MultiTexCoord7 " +
                  "gl_FogCoord gl_PointCoord " +
                  "gl_Position gl_PointSize gl_ClipVertex " +
                  "gl_FrontColor gl_BackColor gl_FrontSecondaryColor gl_BackSecondaryColor " +
                  "gl_TexCoord gl_FogFragCoord " +
                  "gl_FragCoord gl_FrontFacing " +
                  "gl_FragData gl_FragDepth " +
                  "gl_ModelViewMatrix gl_ProjectionMatrix gl_ModelViewProjectionMatrix " +
                  "gl_TextureMatrix gl_NormalMatrix gl_ModelViewMatrixInverse " +
                  "gl_ProjectionMatrixInverse gl_ModelViewProjectionMatrixInverse " +
                  "gl_TexureMatrixTranspose gl_ModelViewMatrixInverseTranspose " +
                  "gl_ProjectionMatrixInverseTranspose " +
                  "gl_ModelViewProjectionMatrixInverseTranspose " +
                  "gl_TextureMatrixInverseTranspose " +
                  "gl_NormalScale gl_DepthRange gl_ClipPlane " +
                  "gl_Point gl_FrontMaterial gl_BackMaterial gl_LightSource gl_LightModel " +
                  "gl_FrontLightModelProduct gl_BackLightModelProduct " +
                  "gl_TextureColor gl_EyePlaneS gl_EyePlaneT gl_EyePlaneR gl_EyePlaneQ " +
                  "gl_FogParameters " +
                  "gl_MaxLights gl_MaxClipPlanes gl_MaxTextureUnits gl_MaxTextureCoords " +
                  "gl_MaxVertexAttribs gl_MaxVertexUniformComponents gl_MaxVaryingFloats " +
                  "gl_MaxVertexTextureImageUnits gl_MaxTextureImageUnits " +
                  "gl_MaxFragmentUniformComponents gl_MaxCombineTextureImageUnits " +
                  "gl_MaxDrawBuffers"),
      indentSwitch: false,
      hooks: {"#": cppHook},
      modeProps: {fold: ["brace", "include"]}
    });
  
    def("text/x-nesc", {
      name: "clike",
      keywords: words(cKeywords + " as atomic async call command component components configuration event generic " +
                      "implementation includes interface module new norace nx_struct nx_union post provides " +
                      "signal task uses abstract extends"),
      types: cTypes,
      blockKeywords: words(cBlockKeywords),
      atoms: words("null true false"),
      hooks: {"#": cppHook},
      modeProps: {fold: ["brace", "include"]}
    });
  
    def("text/x-objectivec", {
      name: "clike",
      keywords: words(cKeywords + " " + objCKeywords),
      types: objCTypes,
      builtin: words(objCBuiltins),
      blockKeywords: words(cBlockKeywords + " @synthesize @try @catch @finally @autoreleasepool @synchronized"),
      defKeywords: words(cDefKeywords + " @interface @implementation @protocol @class"),
      dontIndentStatements: /^@.*$/,
      typeFirstDefinitions: true,
      atoms: words("YES NO NULL Nil nil true false nullptr"),
      isReservedIdentifier: cIsReservedIdentifier,
      hooks: {
        "#": cppHook,
        "*": pointerHook,
      },
      modeProps: {fold: ["brace", "include"]}
    });
  
    def("text/x-objectivec++", {
      name: "clike",
      keywords: words(cKeywords + " " + objCKeywords + " " + cppKeywords),
      types: objCTypes,
      builtin: words(objCBuiltins),
      blockKeywords: words(cBlockKeywords + " @synthesize @try @catch @finally @autoreleasepool @synchronized class try catch"),
      defKeywords: words(cDefKeywords + " @interface @implementation @protocol @class class namespace"),
      dontIndentStatements: /^@.*$|^template$/,
      typeFirstDefinitions: true,
      atoms: words("YES NO NULL Nil nil true false nullptr"),
      isReservedIdentifier: cIsReservedIdentifier,
      hooks: {
        "#": cppHook,
        "*": pointerHook,
        "u": cpp11StringHook,
        "U": cpp11StringHook,
        "L": cpp11StringHook,
        "R": cpp11StringHook,
        "0": cpp14Literal,
        "1": cpp14Literal,
        "2": cpp14Literal,
        "3": cpp14Literal,
        "4": cpp14Literal,
        "5": cpp14Literal,
        "6": cpp14Literal,
        "7": cpp14Literal,
        "8": cpp14Literal,
        "9": cpp14Literal,
        token: function(stream, state, style) {
          if (style == "variable" && stream.peek() == "(" &&
              (state.prevToken == ";" || state.prevToken == null ||
               state.prevToken == "}") &&
              cppLooksLikeConstructor(stream.current()))
            return "def";
        }
      },
      namespaceSeparator: "::",
      modeProps: {fold: ["brace", "include"]}
    });
  
    def("text/x-squirrel", {
      name: "clike",
      keywords: words("base break clone continue const default delete enum extends function in class" +
                      " foreach local resume return this throw typeof yield constructor instanceof static"),
      types: cTypes,
      blockKeywords: words("case catch class else for foreach if switch try while"),
      defKeywords: words("function local class"),
      typeFirstDefinitions: true,
      atoms: words("true false null"),
      hooks: {"#": cppHook},
      modeProps: {fold: ["brace", "include"]}
    });
  
    // Ceylon Strings need to deal with interpolation
    var stringTokenizer = null;
    function tokenCeylonString(type) {
      return function(stream, state) {
        var escaped = false, next, end = false;
        while (!stream.eol()) {
          if (!escaped && stream.match('"') &&
                (type == "single" || stream.match('""'))) {
            end = true;
            break;
          }
          if (!escaped && stream.match('``')) {
            stringTokenizer = tokenCeylonString(type);
            end = true;
            break;
          }
          next = stream.next();
          escaped = type == "single" && !escaped && next == "\\";
        }
        if (end)
            state.tokenize = null;
        return "string";
      }
    }
  
    def("text/x-ceylon", {
      name: "clike",
      keywords: words("abstracts alias assembly assert assign break case catch class continue dynamic else" +
                      " exists extends finally for function given if import in interface is let module new" +
                      " nonempty object of out outer package return satisfies super switch then this throw" +
                      " try value void while"),
      types: function(word) {
          // In Ceylon all identifiers that start with an uppercase are types
          var first = word.charAt(0);
          return (first === first.toUpperCase() && first !== first.toLowerCase());
      },
      blockKeywords: words("case catch class dynamic else finally for function if interface module new object switch try while"),
      defKeywords: words("class dynamic function interface module object package value"),
      builtin: words("abstract actual aliased annotation by default deprecated doc final formal late license" +
                     " native optional sealed see serializable shared suppressWarnings tagged throws variable"),
      isPunctuationChar: /[\[\]{}\(\),;\:\.`]/,
      isOperatorChar: /[+\-*&%=<>!?|^~:\/]/,
      numberStart: /[\d#$]/,
      number: /^(?:#[\da-fA-F_]+|\$[01_]+|[\d_]+[kMGTPmunpf]?|[\d_]+\.[\d_]+(?:[eE][-+]?\d+|[kMGTPmunpf]|)|)/i,
      multiLineStrings: true,
      typeFirstDefinitions: true,
      atoms: words("true false null larger smaller equal empty finished"),
      indentSwitch: false,
      styleDefs: false,
      hooks: {
        "@": function(stream) {
          stream.eatWhile(/[\w\$_]/);
          return "meta";
        },
        '"': function(stream, state) {
            state.tokenize = tokenCeylonString(stream.match('""') ? "triple" : "single");
            return state.tokenize(stream, state);
          },
        '`': function(stream, state) {
            if (!stringTokenizer || !stream.match('`')) return false;
            state.tokenize = stringTokenizer;
            stringTokenizer = null;
            return state.tokenize(stream, state);
          },
        "'": function(stream) {
          stream.eatWhile(/[\w\$_\xa1-\uffff]/);
          return "atom";
        },
        token: function(_stream, state, style) {
            if ((style == "variable" || style == "type") &&
                state.prevToken == ".") {
              return "variable-2";
            }
          }
      },
      modeProps: {
          fold: ["brace", "import"],
          closeBrackets: {triples: '"'}
      }
    });
  
  });