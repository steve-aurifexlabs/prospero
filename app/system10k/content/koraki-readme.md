Koraki Compiler
===============

Koraki is a general purpose compiler.  It currently compiles from a C-like language, Stazie, to Asmir, a language similar to the LLVM IR.

**Source code to come.**

Usage
-----

You can symlink koraki into your path if you want:

    ln -s <path-to-koraki>/dist/koraki /usr/bin/koraki

Then compile and run some code:

    koraki examples/demo.sta

To rebuild the compiler, from the 'src' directory run:

    node rebuild.js



Inside the Compiler
--------------------------

The compiler is organized into passes. Each pass is a set of functions corresponding to the node types. If a function is not present then the corresponding default function is called so that the entire tree is still traversed.

The compiler can also be thought of as divided into three phases: syntax transformation, semantic analysis, and code generation. Other than how the passes directory is organized, phases aren't a first class thing in the compiler. The compiler just operates on a flat list of passes.

### Current inconsistencies

See src/main.js for the list of passes actually being used. Right now nameChildren, processLeaves, operatorPrecedence, and parentRefernces passes are all done as part of postParse. All of the semantic analysis phase is done as one pass. 
In the code gen phase, the resolveHardware pass is done as a part of assignRegisters.

In the emitAssembly section there is reference to the base pointer. For now immediate memory operations are used for global variables. But in order to place a program somewhere other than the start of memory there needs to be a reference to the start of program data (base pointer). Also ARM doesn't have this mode; it expects an address to be in a register.


### Syntax Phase

One design goal of the compiler is to support multiple syntaxes for a language. The canonical source representation is the JSON document emitted by the syntax phase and passed onto the semantics phase. The current syntax phase implementation can be thought of as a reference concrete syntax for Stazie.

In the syntax phase, source code is parsed into an ast, the resulting tree is cleaned up, and operators are converted to simple function calls with correct precedence.   

##### Parser - passes/syntax/parse

The parser is generated using a parser generator, Waxeye. The grammar can be found in passes/syntax/parse/grammar.waxeye. The parser directly generates a raw ast using the production rules. The start symbol for the grammar is 'module'.

Grammar

    Module <- *(Line)
    ...
    Identifier <- [a-zA-Z_] *([0-9a-zA-Z_])
    Number <- ?'-' ('0' | [1-9] *[0-9])
    ...
    FunctionCall <- Identifier :'(' Ws FunctionCallArgumentList Ws :')'
    FunctionCallArgumentList <- ?(Expression *(Comma Expression))


Source Code

    print(97)

Resulting Tree

    { type: 'module',
      children: 
       [ { children: 
            [ { children: [ 'p', 'r', 'i', 'n', 't' ], type: 'identifier' },
              { children: [ { children: [ '9', '7' ], type: 'number' } ],
                type: 'functionCallArgumentList' } ],
           type: 'functionCall' } ] }


The root node of the tree will always be of type 'module', therefore passes will always start on this node type. 

##### Post Parse Passes - /passes/syntax/nameChildren and /passes/syntax/processLeaves

The raw tree is cumbersome to work with for a couple reasons. Children are represented positionally, and leaf nodes represent data as an array of chars. So the next step is to name all the positional attributes(nameChildren). Then go ahead and process leaf nodes to convert identifiers to strings and literals to their native type(processLeaves).

    { type: 'module',
      body: 
       [ { type: 'functionCall',
           name: 'print',
           arguments: [ { type: 'number', value: 97 } ] } ] }

##### Binary Operator Precedence - /passes/syntax/operatorPrecedence

In this pass operator precedence is applied and a binary tree of operations is created.
In the grammar, binary expressions match as a flat data structure with no precedence applied.

    BinaryExpression <= NonBinaryExpression +(Ws BinaryOperator Ws NonBinaryExpression)
    
The expression is split from the top down recursively. The operator precedence table is iterated over from least to most tightly bound operators and matched against operators in the expression from right to left. 

Source
    
    150 + 22 * 3

Tree
    
    { type: 'binaryExpression',
      operator: '+',
      leftOperand: { type: 'number', value: 150 },
      rightOperand: 
      { type: 'binaryExpression',
         operator: '*',
         leftOperand: { type: 'number', value: 22 },
         rightOperand: { type: 'number', value: 3 } } }

##### Operator to function conversion - passes/syntax/operatorConversion
Finally, operators are converted into simple function calls.

    { type: 'functionCall',
      arguments: 
       [ { type: 'number', value: 150 },
         { type: 'functionCall',
           arguments: [ { type: 'number', value: 22 }, { type: 'number', value: 3 } ],
           name: '__operator_multiply__' } ],
      name: '__operator_plus__' }

### Semantic Analysis Phase

The semantics phase is responsible for annotating the ast with information such as scopes, types, and stack frame sizes.
There shouldn't be any dependencies on particular hardware features in this phase. One way to think about it is that there is meaning assigned by the language definition that is independent of how it's represented (syntax), and that it can actually be run (code generation). The goal of this phase is to collect that information and present it to the code gen phase on a silver platter.

##### Add parent references - passes/semantics/parentReferences

Simply adds a reference to the parent of every node. This will be used to discover scopes and enclosing while statements.

##### Discover scopes - passes/semantics/discoverScopes

Adds references to the nearest enclosing scope and global scope to every node. Also adds references to the nearest "while" for "continue" and "break" nodes.

##### Build symbol tables - passes/semantics/buildSymbolTables

Creates a symbol table for named variables and a temporaries table for the module (globals) and every function definition (locals). It also creates a functions table at the module level.

Assignments add to the symbol tables. Identifier lookups then can check that the variable has been created. Nested function calls generate temporary variables. This is totally unoptimized so often stores are followed by loads at the same address. Function definitions add to the functions table.

    { type: 'functionDefinition',
      name: 'myFunc',
      arguments: [ 'a' ],
      body: ...
      symbols: { a: 1 },
      temps: [],
      nextLocalAddress: 2 }


##### Calculate stack frame sizes - passes/semantics/calculateFrameSizes

Once the symbol tables are built then stack frame sizes can be calculated for function definitions by adding the number of local variables, temporaries, and arguments, plus 1 for the return address.


    { type: 'functionDefinition',
      name: 'myFunc',
      arguments: [ 'a' ],
      body: ...
      symbols: { a: 1 },
      temps: [],
      nextLocalAddress: 2,
      stackFrameSize: 2 },
      
The size of the global stack frame is also calculated so that the stack pointer can start offset by this amount.
This is simply the number of global variables plus the number of global temporaries. Functions are not first class so there's no need for a reference on the stack. Functions will be placed after global code during assembly, and labels are used to resolve them.

##### Assign label ids - passes/semantics/assignLabels

Control flow structures need unique labels for branch targets. if/else/else if, while loops, and function calls all get unique labels.

    .{ type: 'whileStatement',
       condition: ...
       body: ... 
       testStartLabel: ',startWhileTest-0',
       bodyEndLabel: '.endWhileBody-1' },

Some targets are within the node itself, and others target the instruction after the block corresponding to the node. For example, "while" has both types.

 In order to simplify adding labels, there are two types of labels. Labels starting with ',' start on the instruction *with* the label, and labels starting with '.' start on the instruction *after* the label.
 
 At this point the labels are not part of instructions, but when the time comes they can be added easily with this format and then resolved by the assembler. 

### Code Generation Phase

This phase includes all the machine dependencies and results in runnable code.

##### Resolve hardware operations - passes/codegen/resolveHardware

Some operations can be done directly in hardware. This is a very platform dependent phase and by separating it from actually producing assembly simplifies generating code for multiple targets.

Function calls that match the available hardware ops are converted to functions starting with "\_\_hw\_"

##### Assign registers - passes/codegen/assignRegisters

The current implementation does no optimizations.  All operations target the 'Z' register by default. Data processing operations use 'X' and 'Y' for operands. Nodes higher up in the tree can override the lower node's target register so that it directly flows into the correct operand registers.

All temporaries and named variables are stored to memory when assigned and loaded from memory when referenced.
All function call arguments are actually put on the stack regardless of number.

This is where proper register allocation should occur.

##### Emit assembly - passes/codegen/emitAssembly

The real work of spitting out assembly. Blocks of assembly are bubbled up the tree and concatenated. Control flow structures are flattened with labels applied to specific instructions.

Assignments and identifiers generate load/store instructions relative to the base pointer or stack pointer for globals and locals respectively. Function call trees that generate temporaries also generate similar load/store instructions.

Function definitions include a prologue and an epilogue. The prologue stores the return address on the stack, and then adds the stack frame size to the current stack pointer. The epilogue moves the last result into the return register, subtracts the stack frame size from the stack pointer, loads the return address from the stack into the link register, and returns.

Function calls must store the argument values on the stack before the call itself. When arguments are stored they start immediately after the stack pointer i.e. sp + 1. When retrieved inside the function the stack pointer has been moved so they must be addressed as sp - stackframesize + 1, ... This address is what is stored in a function definition's symbol table.

When function call arguments are also function calls, then temporaries need to be used. The argument list is handled at runtime in two passes. First all the arguments that are function calls are evaluated and stored in temporary variables. Then all those temporaries are loaded and then stored on the stack. After this the call itself can happen and the instruction after the call moves the return register into the function's target register. 

    [{ op: 'load-literal', value: 1, targetRegister: 'sp' },
     { op: 'load-literal', value: 1156, targetRegister: 'X' },
     { op: 'load-literal', value: 23, targetRegister: 'Y' },
     { op: 'add', operand0: 'X', operand1: 'Y', targetRegister: 'Z' },
     { op: 'store', mode: 'immediate', sourceRegister: 'Z', address: 0 },
     { op: 'load', mode: 'immediate', targetRegister: 'X', address: 0 },
     { op: 'print', register: 'X' },
     { op: 'exit' } ]

##### Assemble - passes/codegen/assemble

Now that there is a flat list of instructions, labels can be replaced with actual addresses.
Data memory and program memory occupy separate memory spaces for now.

### Tips for exploring the source code

If you're looking at the source, start with main.js. Then check out passes/defaults.js to see how tree traversal works.
Then take a look at the passes themselves.

You can inspect the output by including the --asm option. This will print human readable assembly.
You can see the before and after state of an individual pass with the --pass=<pass> option. 
Use the --debug option to see the result of every instruction in the vm.
You can dump the ast after every pass with the --verbose option, but it gets unwieldy real quick.

    koraki examples/fib.sta --pass=assignRegisters --asm

Stazie Spec
-----------

Stazie is a C-level language with slightly different features.
It currently only supports ints.

#### Grammar

See passes/syntax/parse/grammar.waxeye

#### Operators

    print(4 + 5 * 2 > 123 && !(4 < 6) || 4 >> 2 != 0)

Binary Operators:

    var operatorPrecedence = [
      ['||'],
      ['&&'],
      ['|'],
      ['&'],
      ['^'],
      ['==', '!='],
      ['<', '>', '<=', '>='],
      ['<<', '>>'],
      ['+', '-'],
      ['*', '/', '%']
    ];

Unary Operators:

    !, ~, -

Comparison operators return 0/1 instead of false/true because there are no booleans.
Parentheses work as expected.

#### if / else / else if

Work as expected. Blocks are required. No single statement bodies.

    a = 3
    if(a == 1) {
      print(7)
    } else if(a == 2) {
      print(8)
    } else {
      print(9)
    }

#### while / continue / break

Work as expected.

    i = 6
    while(i > 0) {
      i = i - 1
      if(i == 8) {
        break
      }
      if(i == 3) {
        continue
      }
      print(i)
    }

#### Functions

    function myFunc(arg1, arg2) {
      return arg1 + 2 * arg2
    }
    print(myFunc(5, 7))

Functions are not first class; they must be defined at the top level of a module.
Recursion is supported.
return statement is supported.
Nested scopes and closures are not supported.

#### Variables, scoping, and types

All variables are implicitly 32-bit signed ints.

A local variable can shadow a global one. By default assignments from local scope create a local variable.
The global keyword can be used with an assignment to force assignment to a global from a local scope.

    a = 5
    function f() {
      global a = 7
    }
    print(a)

#### Builtins

Just print.

#### Next Steps

- Comments
- Sugar: augmented assignment(+=), postfix operators(++), multiple assignment(a = b = 0)
- for, switch
- assert
- Types - float, bool, char
- Pointers
- Arrays
- Structs
- Strings (using arrays and structs)

Asmir Spec
----------

Asmir is a low level virtual machine similar in purpose to LLVM.

It uses JSON to represent machine code; a single array of instruction objects with opcodes and registers represented by strings. A traditional assembly language representation can be dumped by the compiler for debugging.

#### Instruction Set

It is essentially a load-store architecture with an infinite register file, infinite memory, and an expandable instruction set. For now it has a RISC instruction set designed around easy translation to ARM.

**Take a look at vm/vm.js**

#### Example

    [{ op: 'load-literal', value: 1, targetRegister: 'sp' },
     { op: 'load-literal', value: 1156, targetRegister: 'X' },
     { op: 'load-literal', value: 23, targetRegister: 'Y' },
     { op: 'add', operand0: 'X', operand1: 'Y', targetRegister: 'Z' },
     { op: 'store', mode: 'immediate', sourceRegister: 'Z', address: 0 },
     { op: 'load', mode: 'immediate', targetRegister: 'X', address: 0 },
     { op: 'print', register: 'X' },
     { op: 'exit' } ]

#### Next Steps

Add more powerful instructions similar to ARM.
Namely load/store multiple and floating point ops.

