/**************************************************************************
 *
 * Copyright (c) 2024, 2026 Stefan Möding
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1. Redistributions of source code must retain the above copyright
 *    notice, this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright
 *    notice, this list of conditions and the following disclaimer in the
 *    documentation and/or other materials provided with the distribution.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 **************************************************************************/


#include <stdlib.h>
#include <string.h>
#include <ctype.h>

#include "tree_sitter/parser.h"
#include "tree_sitter/alloc.h"
#include "tree_sitter/array.h"


/**
 * The tokens that this scanner will detect. The order must be the same as
 * defined in the 'externals' field in the grammar.
 */

enum TokenType {
  STRING,
  NUMBER,
  END_OF_TOKEN,
};


/**
 * Scan for a string. A string can start with either a single or a double
 * quote.
 */

static inline bool scan_string(TSLexer *lexer) {
  int32_t quote = 0;

  typedef enum ScanString {
    WHITESPACE,
    CONTENT,
  } ScanString;

  for(ScanString position=WHITESPACE;;) {
    // We are done if the end of file is reached
    if (lexer->eof(lexer)) return false;

    switch (position) {
    case WHITESPACE:
      if (isspace(lexer->lookahead)) {
        // Skip whitespace, newline, ...
        lexer->advance(lexer, true);
        continue;
      }
      else if (lexer->lookahead == U'"' || lexer->lookahead == U'\'') {
        quote = lexer->lookahead;
        position = CONTENT;
        break;
      }

      // Doesn't look like a valid string
      return false;
      break;

    case CONTENT:
      if (lexer->lookahead == quote) {
        lexer->advance(lexer, false);

        // We are only done if this is not a double quote
        if (lexer->lookahead != quote) return true;
      }
      break;
    }

    lexer->advance(lexer, false);
  }

  return false;
}

/**
 * Scan for a numeric literal. This implementation is not gready to parse
 * the dot as decimal separator. If a dot is followed by another dot this
 * will not be parsed as number but as a value range (e.g. 1..5).
 */

static inline bool scan_number(TSLexer *lexer) {
  int integer_digits = 0;
  int fractional_digits = 0;

  typedef enum ScanNumber {
    WHITESPACE,
    SIGN,
    INTEGER,
    DECIMAL,
    FRACTION,
    EXPONENT_SIGN,
    EXPONENT,
  } ScanNumber;

  for(ScanNumber position=WHITESPACE;;) {
    // We are done if the end of file is reached
    if (lexer->eof(lexer)) return false;

    switch (position) {
    case WHITESPACE:
      if (isspace(lexer->lookahead)) {
        // Skip whitespace, newline, ...
        lexer->advance(lexer, true);
        break;
      }
      else if (lexer->lookahead == U'+' || lexer->lookahead == U'-') {
        lexer->mark_end(lexer); // Do not (yet) consume the sign
        lexer->advance(lexer, false);
        position = SIGN;
        break;
      }
      else if (isdigit(lexer->lookahead)) {
        lexer->mark_end(lexer);
        position = INTEGER;
        break;
      }
      else if (lexer->lookahead == U'.') {
        lexer->mark_end(lexer); // Do not (yet) consume the '.'
        lexer->advance(lexer, false);
        position = DECIMAL;
        break;
      }

      // Doesn't look like a valid numeric literal
      return false;
      break;

    case SIGN:
      if (isdigit(lexer->lookahead)) {
        lexer->mark_end(lexer);
        position = INTEGER;
        break;
      }
      else if (lexer->lookahead == U'.') {
        lexer->mark_end(lexer); // Do not (yet) consume the '.'
        lexer->advance(lexer, false);
        position = DECIMAL;
        break;
      }

      // Doesn't look like a valid numeric literal
      return false;
      break;

    case INTEGER:
      if (isdigit(lexer->lookahead)) {
        lexer->advance(lexer, false);
        lexer->mark_end(lexer);
        integer_digits++;
        break;
      }
      else if (lexer->lookahead == U'.') {
        lexer->advance(lexer, false);
        position = DECIMAL;
        break;
      }
      else if ((lexer->lookahead == U'E') || (lexer->lookahead == U'e')) {
        lexer->advance(lexer, false);
        lexer->mark_end(lexer);
        position = EXPONENT_SIGN;
        break;
      }

      return (integer_digits > 0);
      break;

    case DECIMAL:
      if ((lexer->lookahead == U'E') || (lexer->lookahead == U'e')) {
        lexer->advance(lexer, false);
        position = EXPONENT_SIGN;
        break;
      }
      else if (isdigit(lexer->lookahead)) {
        position = FRACTION;
        break;
      }
      else if (lexer->lookahead != U'.') {
        // Two consecutive dots indicate a range, so we only consume the
        // dot here if it is not followed by another dot.
        lexer->mark_end(lexer);
      }

      return (integer_digits > 0);
      break;

    case FRACTION:
      if (isdigit(lexer->lookahead)) {
        lexer->advance(lexer, false);
        fractional_digits++;
        break;
      }
      else if ((lexer->lookahead == U'E') || (lexer->lookahead == U'e')) {
        lexer->advance(lexer, false);
        position = EXPONENT_SIGN;
        break;
      }

      lexer->mark_end(lexer);
      return ((integer_digits > 0) || (fractional_digits > 0));
      break;

    case EXPONENT_SIGN:
      if ((lexer->lookahead == U'+') || (lexer->lookahead == U'-')) {
        lexer->advance(lexer, false);
        position = EXPONENT;
        break;
      }
      else if (isdigit(lexer->lookahead)) {
        position = EXPONENT;
        break;
      }

      // Exponent has no sign and no digits
      return false;
      break;

    case EXPONENT:
      if (isdigit(lexer->lookahead)) {
        lexer->advance(lexer, false);
        break;
      }

      lexer->mark_end(lexer);
      return true;
      break;
    }
  }

  return false;
}

/**
 * Check if the lookahead character does not look like a symbol token. This
 * is used to ensure certain keywords like 'in' are used isolated and are
 * not part of a longer identifier like 'input'.
 */

static inline bool check_end_of_token(TSLexer *lexer) {
  // Return a zero-length token (don't advance the lexer state)
  return !(isalnum(lexer->lookahead) || lexer->lookahead == U'_');
}

/**
 * The public interface used by the tree-sitter parser
 */

void *tree_sitter_mathprog_external_scanner_create() {
  return NULL;
}

void tree_sitter_mathprog_external_scanner_destroy(void *payload) {
}

unsigned tree_sitter_mathprog_external_scanner_serialize(void *payload, char *buffer) {
  return 0;
}

void tree_sitter_mathprog_external_scanner_deserialize(void *payload, const char *buffer, unsigned length) {
}

bool tree_sitter_mathprog_external_scanner_scan(void *payload, TSLexer *lexer, const bool *valid_symbols) {
  if (valid_symbols[END_OF_TOKEN]) {
    if (check_end_of_token(lexer)) {
      lexer->result_symbol = END_OF_TOKEN;
      return true;
    }
  }
  if (valid_symbols[STRING]) {
    if (scan_string(lexer)) {
      lexer->result_symbol = STRING;
      return true;
    }
  }
  if (valid_symbols[NUMBER]) {
    if (scan_number(lexer)) {
      lexer->result_symbol = NUMBER;
      return true;
    }
  }

  return false;
}
