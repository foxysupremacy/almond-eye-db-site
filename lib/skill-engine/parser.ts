// Pratt parser for the skill-condition mini-language. Ported verbatim from
// uma-tools/uma-skill-tools/ConditionParser.ts.
//
// Grammar:
//   Or  ::= And '@' Or | And
//   And ::= Cmp '&' And | Cmp
//   Cmp ::= condition Op integer
//   Op  ::= '==' | '!=' | '>' | '>=' | '<' | '<='
// No parentheses; no way to control precedence.

import type { Condition, Operator } from "./types";
import {
  AndOperator,
  EqOperator,
  GteOperator,
  GtOperator,
  LteOperator,
  LtOperator,
  NeqOperator,
  OrOperator,
} from "./conditions";

class ParseError extends Error {}

function isId(c: number) {
  return (
    ("a".charCodeAt(0) <= c && c <= "z".charCodeAt(0)) ||
    ("0".charCodeAt(0) <= c && c <= "9".charCodeAt(0)) ||
    c === "_".charCodeAt(0)
  );
}

interface Token<C, O> {
  lbp: number;
  led(state: ParserState<C, O>, left: Node<C, O>): Node<C, O>;
  nud(state: ParserState<C, O>): Node<C, O>;
}

export const enum NodeType {
  Int,
  Cond,
  Op,
}
export type Node<C = Condition, O = Operator> =
  | { type: NodeType.Int; value: number }
  | { type: NodeType.Cond; cond: C }
  | { type: NodeType.Op; op: O };

type ParserState<C, O> = { current: Token<C, O>; next: Token<C, O>; tokens: Iterator<Token<C, O>> };

class IntValue<C, O> implements Token<C, O> {
  lbp = 0;
  constructor(readonly value: number) {}
  led(_s: ParserState<C, O>, _l: Node<C, O>): Node<C, O> {
    throw new ParseError("unexpected integer literal");
  }
  nud(_s: ParserState<C, O>) {
    return { type: NodeType.Int, value: this.value } as Node<C, O>;
  }
}

interface Operators<C, O> {
  and: new (l: O, r: O) => O;
  or: new (l: O, r: O) => O;
  eq: new (c: C, a: number) => O;
  neq: new (c: C, a: number) => O;
  lt: new (c: C, a: number) => O;
  lte: new (c: C, a: number) => O;
  gt: new (c: C, a: number) => O;
  gte: new (c: C, a: number) => O;
}

export function getParser<C = Condition, O = Operator>(
  conditions: { [cond: string]: C } = {} as { [cond: string]: C },
  operators: Operators<C, O> = {
    and: AndOperator as unknown as new (l: O, r: O) => O,
    or: OrOperator as unknown as new (l: O, r: O) => O,
    eq: EqOperator as unknown as new (c: C, a: number) => O,
    neq: NeqOperator as unknown as new (c: C, a: number) => O,
    lt: LtOperator as unknown as new (c: C, a: number) => O,
    lte: LteOperator as unknown as new (c: C, a: number) => O,
    gt: GtOperator as unknown as new (c: C, a: number) => O,
    gte: GteOperator as unknown as new (c: C, a: number) => O,
  },
) {
  const Eof = Object.freeze({
    lbp: 0,
    led: (_s: ParserState<C, O>, _l: Node<C, O>): Node<C, O> => {
      throw new ParseError("unexpected eof");
    },
    nud: (_s: ParserState<C, O>): Node<C, O> => {
      throw new ParseError("unexpected eof");
    },
  });

  class Identifier implements Token<C, O> {
    lbp = 0;
    constructor(readonly value: string) {}
    led(_s: ParserState<C, O>, _l: Node<C, O>): Node<C, O> {
      throw new ParseError("unexpected identifier");
    }
    nud(_s: ParserState<C, O>) {
      return { type: NodeType.Cond, cond: conditions[this.value as keyof typeof conditions] } as Node<
        C,
        O
      >;
    }
  }

  class CmpOp {
    constructor(
      readonly lbp: number,
      readonly opclass: new (c: C, a: number) => O,
    ) {}
    led(state: ParserState<C, O>, left: Node<C, O>) {
      if (left.type !== NodeType.Cond) throw new ParseError("expected condition on left hand side of comparison");
      const right = expression(state, this.lbp);
      if (right.type !== NodeType.Int) throw new ParseError("expected number on right hand side of comparison");
      return { type: NodeType.Op, op: new this.opclass(left.cond, right.value) } as Node<C, O>;
    }
    nud(_s: ParserState<C, O>): Node<C, O> {
      throw new ParseError("expected expression");
    }
  }

  class LogicalOp {
    constructor(
      readonly lbp: number,
      readonly opclass: new (l: O, r: O) => O,
    ) {}
    led(state: ParserState<C, O>, left: Node<C, O>) {
      if (left.type !== NodeType.Op) throw new ParseError("expected comparison on left hand side of operator");
      const right = expression(state, this.lbp);
      if (right.type !== NodeType.Op) throw new ParseError("expected comparison on right hand side of operator");
      return { type: NodeType.Op, op: new this.opclass(left.op, right.op) } as Node<C, O>;
    }
    nud(_s: ParserState<C, O>): Node<C, O> {
      throw new ParseError("expected expression");
    }
  }

  const OperatorEq = Object.freeze(new CmpOp(30, operators.eq));
  const OperatorNeq = Object.freeze(new CmpOp(30, operators.neq));
  const OperatorLt = Object.freeze(new CmpOp(30, operators.lt));
  const OperatorLte = Object.freeze(new CmpOp(30, operators.lte));
  const OperatorGt = Object.freeze(new CmpOp(30, operators.gt));
  const OperatorGte = Object.freeze(new CmpOp(30, operators.gte));
  const OperatorAnd = Object.freeze(new LogicalOp(20, operators.and));
  const OperatorOr = Object.freeze(new LogicalOp(10, operators.or));

  function* tokenize(s: string) {
    let i = 0;
    while (i < s.length) {
      let c = s.charCodeAt(i);
      if ("0".charCodeAt(0) <= c && c <= "9".charCodeAt(0)) {
        let n = 0;
        while ("0".charCodeAt(0) <= c && c <= "9".charCodeAt(0)) {
          n *= 10;
          n += c - "0".charCodeAt(0);
          c = s.charCodeAt(++i);
        }
        yield new IntValue<C, O>(n);
      } else if (isId(c)) {
        const idstart = i;
        while (isId(c)) {
          c = s.charCodeAt(++i);
        }
        yield new Identifier(s.slice(idstart, i));
      } else
        switch (s[i]) {
          case "=":
            if (s[++i] !== "=") throw new ParseError("expected =");
            ++i;
            yield OperatorEq;
            break;
          case "!":
            if (s[++i] !== "=") throw new ParseError("expected =");
            ++i;
            yield OperatorNeq;
            break;
          case "<":
            if (s[++i] === "=") {
              ++i;
              yield OperatorLte;
            } else {
              yield OperatorLt;
            }
            break;
          case ">":
            if (s[++i] === "=") {
              ++i;
              yield OperatorGte;
            } else {
              yield OperatorGt;
            }
            break;
          case "@":
            yield OperatorOr;
            ++i;
            break;
          case "&":
            yield OperatorAnd;
            ++i;
            break;
          default:
            throw new ParseError("invalid character");
        }
    }
    return Eof;
  }

  function parseAny(tokens: Iterator<Token<C, O>>) {
    const state = { current: Eof, next: tokens.next().value, tokens };
    return expression(state, 0);
  }

  function parse(tokens: Iterator<Token<C, O>>) {
    const node = parseAny(tokens);
    if (node.type !== NodeType.Op) {
      throw new ParseError("expected comparison or operator");
    }
    return node.op;
  }

  function expression(state: ParserState<C, O>, rbp: number) {
    state.current = state.next;
    state.next = state.tokens.next().value;
    let left = state.current.nud(state);
    while (rbp < state.next.lbp) {
      state.current = state.next;
      state.next = state.tokens.next().value;
      left = state.current.led(state, left);
    }
    return left;
  }

  return { tokenize, parse, parseAny };
}
