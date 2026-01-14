//
// Modeling Language GNU MathProg
// Language Reference for GLPK Version 5.0
//
// Copyright (c) 2024, 2025, 2026 Stefan Möding
//
// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are
// met:
//
// 1. Redistributions of source code must retain the above copyright
//    notice, this list of conditions and the following disclaimer.
//
// 2. Redistributions in binary form must reproduce the above copyright
//    notice, this list of conditions and the following disclaimer in the
//    documentation and/or other materials provided with the distribution.
//
// THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
// "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
// LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
// A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
// HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
// SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
// LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
// DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
// THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
// (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
// OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
//

const PREC = {
  COND: 2,
  DISJ: 3,                      // logical or
  QUANT: 4,                     // logical reduction operators
  CONJ: 5,                      // logical and
  REL: 6,
  MEMB: 7,                      // membership in set, subset
  NOT: 8,                       // logical negation
  UNION: 9,
  DIFF: 9,
  INTER: 10,
  CROSS: 11,
  SET: 12,                      // setof .. by
  CONCAT: 13,
  ADD: 15,                      // left
  ITER: 16,
  MUL: 17,                      // left
  UNARY: 18,
  EXP: 19,                      // right
  FUNC: 20,
  OUTPUT: 25,
};

export default grammar({
  name: 'mathprog',

  extras: $ => [
    $.comment,
    /[ |\f|\n|\r|\t|\v]+/,
  ],

  conflicts: $ => [
    [ $._primary_num_expr, $._primary_sym_expr, $._primary_set_expr ],
    [ $._primary_num_expr, $._primary_sym_expr ],
    [ $._primary_num_expr, $._primary_set_expr ],
  ],

  externals: $ => [
    $.string,
    $.number,
  ],

  // keyword extraction optimization
  word: $ => $.symbolic_name,

  rules: {
    model: $ => seq(
      repeat($._model_statement),
      optional(seq(
        $.data,
        repeat($._data_statement),
      )),
    ),

    _model_statement: $ => choice(
      $.set,
      $.param,
      $.var,
      $.constraint,
      $.objective,
      $.solve,
      $.check,
      $.display,
      $.printf,
      $.for,
      $.table,
      $.end,
    ),

    _data_statement: $ => choice(
      $.set_data,
      $.param_data,
      $.end,
    ),

    data: $ => seq('data', ';'),

    end: $ => seq('end', ';'),

    //
    // Model statements
    //

    set: $ => seq(
      'set',
      alias($.symbolic_name, $.model_object),
      optional(alias($.string, $.alias)),
      optional($.indexing_expression),
      repeat(seq(optional(','), alias($.set_attrib, $.attribute))),
      ';',
    ),

    set_attrib: $ => choice(
      seq('dimen', alias(/[0-9]+/, $.number)),
      seq('within', alias($.set_expr, $.expr)),
      seq(':=', alias($.set_expr, $.expr)),
      seq('default', alias($.set_expr, $.expr)),
      // warning: keyword in understood as within
      seq('in', alias($.set_expr, $.expr)),
    ),

    param: $ => seq(
      'param',
      alias($.symbolic_name, $.model_object),
      optional(alias($.string, $.alias)),
      optional($.indexing_expression),
      repeat(seq(optional(','), alias($.param_attrib, $.attribute))),
      ';',
    ),

    param_attrib: $ => choice(
      'integer',
      'binary',
      'logical',           // warning: keyword logical understood as binary
      'symbolic',
      seq(
        alias(choice('<', '<=', '=', '==', '>=', '>', '<>', '!='), $.operator),
        alias(choice($.num_expr, $.sym_expr), $.expr),
      ),
      seq('in', alias($.set_expr, $.expr)),
      seq(':=', alias(choice($.num_expr, $.sym_expr), $.expr)),
      seq('default', alias(choice($.num_expr, $.sym_expr), $.expr)),
    ),

    var: $ => seq(
      'var',
      alias($.symbolic_name, $.model_object),
      optional(alias($.string, $.alias)),
      optional($.indexing_expression),
      repeat(seq(optional(','), alias($.var_attrib, $.attribute))),
      ';',
    ),

    var_attrib: $ => choice(
      'integer',
      'binary',
      seq(choice('>=', '<=', '='), alias($.num_expr, $.expr)),
    ),

    constraint: $ => seq(
      optional(choice(seq(choice('subj', 'subject'), 'to'), 's.t.')),
      alias($.symbolic_name, $.model_object),
      optional(alias($.string, $.alias)),
      optional($.indexing_expression),
      ':',
      $.linear_expression,
      optional(','),
      alias(choice('=', '<=', '>='), $.operator),
      $.linear_expression,
      optional(seq(
        optional(','),
        alias(choice('<=', '>='), $.operator),
        $.linear_expression,
      )),
      ';',
    ),

    objective: $ => seq(
      choice('maximize', 'minimize'),
      alias($.symbolic_name, $.model_object),
      optional(alias($.string, $.alias)),
      optional($.indexing_expression),
      ':',
      $.linear_expression,
      ';',
    ),

    solve: $ => seq('solve', ';'),

    check: $ => seq(
      'check',
      optional($.indexing_expression),
      optional(':'),
      alias($.log_expr, $.expr),
      ';',
    ),

    display: $ => seq(
      'display',
      optional($.indexing_expression),
      optional(':'),
      sep1(alias(choice($.num_expr, $.sym_expr, $.log_expr), $.expr), ','),
      ';',
    ),

    printf: $ => seq(
      'printf',
      optional($.indexing_expression),
      optional(':'),
      alias(choice($.num_expr, $.sym_expr, $.log_expr), $.expr),
      repeat(prec(PREC.OUTPUT, seq(
        ',',
        alias(choice($.num_expr, $.sym_expr, $.log_expr), $.expr),
      ))),
      optional(seq(
        alias(choice('>', '>>'), $.operator),
        alias($.sym_expr, $.expr),
      )),
      ';',
    ),

    for: $ => seq(
      'for',
      $.indexing_expression,
      optional(':'),
      choice(
        choice($.check, $.display, $.printf, $.for),
        seq(
          '{',
          repeat1(choice($.check, $.display, $.printf, $.for)),
          '}',
        ),
      ),
    ),

    table: $ => seq(
      'table',
      $.symbolic_name,
      optional(alias($.string, $.alias)),
      choice(
        $._input_table,
        $._output_table,
      ),
      ';',
    ),

    _input_table: $ => seq(
      'IN',
      repeat1($.sym_expr),      // driver + args
      ':',
      optional(seq($.symbolic_name, '<-')),
      '[',
      sep1($.symbolic_name, ','),
      ']',
      optional(seq(
        ',',
        $.symbolic_name,
        optional(seq('~', $.symbolic_name)),
        repeat(seq(
          ',',
          $.symbolic_name,
          optional(seq('~', $.symbolic_name)),
        )),
      )),
    ),

    _output_table: $ => seq(
      optional($.indexing_expression),
      'OUT',
      repeat1($.sym_expr),      // driver + args
      ':',
      choice($.num_expr, $.sym_expr),
      optional(seq('~', $.symbolic_name)),
      repeat(seq(
        ',',
        choice($.num_expr, $.sym_expr),
        optional(seq('~', $.symbolic_name)),
      )),
    ),

    //
    // Data statements
    //

    set_data: $ => seq(
      'set',
      seq(alias($.symbolic_name, $.model_object), optional($.subscript)),
      repeat1(seq(optional(','), alias($.set_data_record, $.record))),
      ';',
    ),

    set_data_record: $ => choice(
      ':=',
      seq('(', $.slice, ')'),
      $._list_data_record,
      $._matrix_data_record,
    ),

    param_data: $ => seq(
      'param',
      choice(
        seq(
          alias($.symbolic_name, $.model_object),
          optional(seq('default', $.value)),
          repeat1(seq(optional(','), alias($.param_data_record, $.record))),
        ),
        seq(
          optional(seq('default', $.value)),
          $._tabbing_data,
        ),
      ),
      ';',
    ),

    param_data_record: $ => choice(
      ':=',
      seq('[', $.slice, ']'),
      $._list_data_record,
      $.tabular_data,
    ),

    tabular_data: $ => prec.right(seq(
      choice(':', seq('(tr)', optional(':'))),
      repeat1($.value),
      ':=',
      repeat1(choice($.value, '.')),
    )),

    _tabbing_data: $ => seq(
      ':',
      optional(seq($.symbolic_name, ':')),
      $.symbolic_name,
      repeat(seq(optional(','), $.value)),
      ':=',
      $._list_data_record,
    ),

    _list_data_record: $ => prec.left(seq(
      $.value,
      repeat(seq(optional(','), $.value)),
    )),

    _matrix_data_record: $ => prec.left(seq(
      choice(':', seq('(tr)', optional(':'))),
      repeat1(choice(':=', $.value, '+', '-')),
    )),

    slice: $ => sep1(choice($.value, '*'), ','),

    value: $ => choice($.number, $.string, $.bareword),

    //
    // Expressions
    //

    num_expr: $ => choice(
      prec.left(seq($._primary_num_expr, optional($.suffix))),

      // Arithmetic operators
      prec.left(PREC.UNARY, seq(
        alias(choice('+', '-'), $.operator),
        alias($.num_expr, $.expr),
      )),
      prec.left(PREC.ADD, seq(
        alias($.num_expr, $.expr),
        alias(choice('+', '-', 'less'), $.operator),
        alias($.num_expr, $.expr),
      )),
      prec.left(PREC.MUL, seq(
        alias($.num_expr, $.expr),
        alias(choice('*', '/', 'div', 'mod'), $.operator),
        alias($.num_expr, $.expr),
      )),
      prec.right(PREC.EXP, seq(
        alias($.num_expr, $.expr),
        alias(choice('**', '^'), $.operator),
        alias($.num_expr, $.expr),
      )),
    ),

    _primary_num_expr: $ => choice(
      $.number,
      seq($.symbolic_name, optional($.subscript)),
      $.function_call,
      alias($.iterated_num_expr, $.iterated_expression),
      alias($.conditional_num_expr, $.conditional_expression),
      seq('(', alias($.num_expr, $.expr), ')'),
    ),

    iterated_num_expr: $ => seq(
      alias(choice('sum', 'prod', 'min', 'max'), $.operator),
      $.indexing_expression,
      alias($.num_expr, $.expr),
    ),

    conditional_num_expr: $ => prec.right(PREC.COND, seq(
      'if',
      alias($.log_expr, $.expr),
      'then',
      alias($.num_expr, $.expr),
      optional(seq('else', alias($.num_expr, $.expr))),
    )),

    sym_expr: $ => choice(
      $._primary_sym_expr,

      // Symbolic operator
      prec.left(PREC.CONCAT, seq(
        alias(choice($.sym_expr, $.num_expr), $.expr),
        alias('&', $.operator),
        alias(choice($.sym_expr, $.num_expr), $.expr),
      )),
    ),

    _primary_sym_expr: $ => choice(
      $.string,
      seq($.symbolic_name, optional($.subscript)),
      $.function_call,
      alias($.conditional_sym_expr, $.conditional_expression),
      seq('(', alias($.sym_expr, $.expr), ')'),
    ),

    conditional_sym_expr: $ => prec.right(PREC.COND, seq(
      'if',
      alias($.log_expr, $.expr),
      'then',
      alias($.sym_expr, $.expr),
      optional(seq('else', alias($.sym_expr, $.expr))),
    )),

    indexing_expression: $ => seq(
      '{',
      sep1($.indexing_entry, ','),
      optional(seq(':', alias($.log_expr, $.expr))),
      '}',
    ),

    indexing_entry: $ => choice(
      alias($.set_expr, $.expr),
      seq(
        $.symbolic_name,
        alias('in', $.operator),
        alias($.set_expr, $.expr),
      ),
      seq(
        '(',
        alias(choice($.num_expr, $.sym_expr), $.expr),
        repeat(seq(',', alias(choice($.num_expr, $.sym_expr), $.expr))),
        ')',
        alias('in', $.operator),
        alias($.set_expr, $.expr),
      ),
    ),

    _primary_set_expr: $ => prec.left(choice(
      $.literal_set,
      seq($.symbolic_name, optional($.subscript)),
      // Arithmetic set
      prec(PREC.SET, seq(
        alias($.num_expr, $.expr),
        '..',
        alias($.num_expr, $.expr),
        optional(seq('by', alias($.num_expr, $.expr))),
      )),
      $.indexing_expression,
      alias($.iterated_set_expr, $.iterated_expression),
      alias($.conditional_set_expr, $.conditional_expression),
      seq('(', alias($.set_expr, $.expr), ')'),
    )),

    set_expr: $ => choice(
      $._primary_set_expr,

      prec.left(PREC.UNION, seq(
        alias($.set_expr, $.expr),
        alias('union', $.operator),
        alias($.set_expr, $.expr),
      )),
      prec.left(PREC.INTER, seq(
        alias($.set_expr, $.expr),
        alias('inter', $.operator),
        alias($.set_expr, $.expr),
      )),
      prec.left(PREC.CROSS, seq(
        alias($.set_expr, $.expr),
        alias('cross', $.operator),
        alias($.set_expr, $.expr),
      )),
      prec.left(PREC.DIFF, seq(
        alias($.set_expr, $.expr),
        alias(choice('diff', 'symdiff'), $.operator),
        alias($.set_expr, $.expr),
      )),
    ),

    literal_set: $ => seq(
      '{',
      optional(choice(
        sep1(choice($.num_expr, $.sym_expr), ','),
        sep1($.tupel, ','),
      )),
      '}',
    ),

    iterated_set_expr: $ => prec(PREC.SET, seq(
      alias('setof', $.operator),
      $.indexing_expression,
      choice(
        alias($.num_expr, $.expr),
        seq('(', sep1(alias($.num_expr, $.expr), ','), ')'),
      )
    )),

    tupel: $ => prec.left(1, seq(
      '(',
      alias(choice($.num_expr, $.sym_expr), $.expr),
      repeat(seq(',', alias(choice($.num_expr, $.sym_expr), $.expr))),
      ')',
    )),

    conditional_set_expr: $ => prec.right(PREC.COND, seq(
      'if',
      alias($.log_expr, $.expr),
      'then',
      alias($.set_expr, $.expr),
      optional(seq('else', alias($.set_expr, $.expr))),
    )),

    _primary_log_expr: $ => prec.left(choice(
      alias($.num_expr, $.expr),
      // Relational expression
      prec(PREC.REL, seq(
        alias($.num_expr, $.expr),
        alias(choice('<', '<=', '=', '==', '>=', '>', '<>', '!='), $.operator),
        alias($.num_expr, $.expr),
      )),
      prec(PREC.REL, seq(
        alias($.sym_expr, $.expr),
        alias(choice('<', '<=', '=', '==', '>=', '>', '<>', '!='), $.operator),
        alias($.sym_expr, $.expr),
      )),
      prec(PREC.MEMB, seq(
        alias(choice($.num_expr, $.tupel), $.expr),
        optional(alias(choice('not', '!'), $.operator)),
        alias('in', $.operator),
        alias($.set_expr, $.expr),
      )),
      prec(PREC.MEMB, seq(
        alias($.set_expr, $.expr),
        optional(alias(choice('not', '!'), $.operator)),
        alias('within', $.operator),
        alias($.set_expr, $.expr),
      )),
      alias($.iterated_log_expr, $.iterated_expression),
      seq('(', alias($.log_expr, $.expr), ')'),
    )),

    log_expr: $ => choice(
      $._primary_log_expr,
      prec.left(PREC.DISJ, seq(
        alias($.log_expr, $.expr),
        alias(choice('or', '||'), $.operator),
        alias($.log_expr, $.expr),
      )),
      prec.left(PREC.CONJ, seq(
        alias($.log_expr, $.expr),
        alias(choice('and', '&&'), $.operator),
        alias($.log_expr, $.expr),
      )),
      prec.left(PREC.NOT, seq(
        alias('not', $.operator),
        alias($.log_expr, $.expr),
      )),
    ),

    iterated_log_expr: $ => prec(PREC.QUANT, seq(
      alias(choice('exists', 'forall'), $.operator),
      $.indexing_expression,
      alias($.log_expr, $.expr),
    )),

    // linear expression
    linear_expression: $ => prec.left(choice(
      $._primary_linear_expr,

      // Arithmetic operators
      prec.left(PREC.UNARY, seq(
        alias(choice('+', '-'), $.operator),
        alias($.linear_expression, $.expr),
      )),
      prec.left(PREC.ADD, seq(
        alias($.linear_expression, $.expr),
        alias(choice('+', '-', 'less'), $.operator),
        alias($.linear_expression, $.expr),
      )),
      prec.left(PREC.MUL, seq(
        alias($.linear_expression, $.expr),
        alias(choice('*', '/', 'div', 'mod'), $.operator),
        alias($.linear_expression, $.expr),
      )),
      prec.right(PREC.EXP, seq(
        alias($.linear_expression, $.expr),
        alias(choice('**', '^'), $.operator),
        alias($.linear_expression, $.expr),
      )),
    )),

    _primary_linear_expr: $ => prec(1, choice(
      alias($.num_expr, $.expr),
      seq($.symbolic_name, optional($.subscript)),
      // Iterated linear expression
      //seq('sum', $.indexing_expression, $.linear_expression),
      alias($.conditional_linear_expr, $.conditional_expression),
      seq('(', $.linear_expression, ')'),
    )),

    conditional_linear_expr: $ => prec.right(PREC.COND, seq(
      'if',
      alias($.log_expr, $.expr),
      'then',
      $.linear_expression,
      optional(seq('else', $.linear_expression)),
    )),

    subscript: $ => seq(
      '[',
      sep1(alias(choice($.num_expr, $.sym_expr), $.expr), ','),
      ']',
    ),

    function_call: $ => seq(
      $.function_name,
      '(',
      optional(sep1(
        alias(choice($.num_expr, $.sym_expr, $.set_expr), $.expr),
        ',')),
      ')',
    ),

    function_name: _ => choice(
      'Irand224',
      'Normal',
      'Normal01',
      'Uniform',
      'Uniform01',
      'abs',
      'atan',
      'card',
      'ceil',
      'cos',
      'exp',
      'floor',
      'gmtime',
      'length',
      'log',
      'log10',
      'max',
      'min',
      'round',
      'sin',
      'sqrt',
      'str2time',
      'substr',
      'tan',
      'time2str',
      'trunc',
    ),

    suffix: $ => token.immediate(/.(lb|ub|status|val|dual)/),

    // Implemented in external parser to handle the comment starter
    // string: $ => choice(
    //   seq("'", repeat(choice(/[^'\\]+/, /\\./, "''")), "'"),
    //   seq('"', repeat(choice(/[^"\\]+/, /\\./, '""')), '"'),
    // ),

    symbolic_name: _ => /[a-zA-Z_][a-zA-Z0-9_]*/,
    bareword: _ => /[a-zA-Z0-9_.+-]+/,

    comment: _ => choice(
      /#.*/,
      seq('/*', repeat(choice(/[^*]+/, /\*[^\/]/, /\\n/)), '*/'),
    ),
  },
});

function sep1(rule, sep) {
  return seq(rule, repeat(prec(1, seq(sep, rule))));
}
