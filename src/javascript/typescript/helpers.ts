import {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLInt,
  GraphQLID,
  GraphQLList,
  GraphQLNonNull,
  GraphQLScalarType,
  GraphQLString,
  GraphQLType,
} from 'graphql'

import * as t from '@babel/types';
import { stripIndent } from 'common-tags';

import { CompilerOptions } from '../../compiler';

const builtInScalarMap = {
  [GraphQLString.name]: t.TSStringKeyword(),
  [GraphQLInt.name]: t.TSNumberKeyword(),
  [GraphQLFloat.name]: t.TSNumberKeyword(),
  [GraphQLBoolean.name]: t.TSBooleanKeyword(),
  [GraphQLID.name]: t.TSStringKeyword(),
}

export function createTypeFromGraphQLTypeFunction(
  compilerOptions: CompilerOptions
): (graphQLType: GraphQLType, typeName?: string) => t.TSType {
  function nonNullableTypeFromGraphQLType(graphQLType: GraphQLType, typeName?: string): t.TSType {
    if (graphQLType instanceof GraphQLList) {
      const elementType = typeFromGraphQLType(graphQLType.ofType, typeName);
      return t.TSArrayType(
        t.isTSUnionType(elementType) ? t.TSParenthesizedType(elementType) : elementType
      );
    } else if (graphQLType instanceof GraphQLScalarType) {
      const builtIn = builtInScalarMap[typeName || graphQLType.name]
      if (builtIn != null) {
        return builtIn;
      } else if (compilerOptions.passthroughCustomScalars) {
        return t.TSAnyKeyword();
      } else {
        return t.TSTypeReference(t.identifier(graphQLType.name));
      }
    } else if (graphQLType instanceof GraphQLNonNull) {
      // This won't happen; but for TypeScript completeness:
      return typeFromGraphQLType(graphQLType.ofType, typeName);
    } else {
      return t.TSTypeReference(t.identifier(typeName || graphQLType.name));
    }
  }

  function typeFromGraphQLType(graphQLType: GraphQLType, typeName?: string): t.TSType {
    if (graphQLType instanceof GraphQLNonNull) {
      return nonNullableTypeFromGraphQLType(graphQLType.ofType, typeName);
    } else {
      const type = nonNullableTypeFromGraphQLType(graphQLType, typeName);
      return t.TSUnionType([type, t.TSNullKeyword()]);
    }
  }

  return typeFromGraphQLType;
}

export function convertStringToDocstringComment(str: string): t.CommentBlock | null {
  // remove initial newlines and trailing whitespace
  const trimmed = stripIndent`${str}`.replace(/(\s+$|^\n+)/g, '');
  if (!trimmed || trimmed.trim() === '') {
    return null;
  }
  const lines = trimmed.split('\n');
  if (lines.length === 0) {
    return null;
  }

  let commentText: string = '';
  if (lines.length === 1) {
    commentText = `* ${lines[0]} `;
  } else {
    commentText = stripIndent`
    *
    ${lines.map(line => ` * ${line.replace(/\s+$/, '')}`)}
    `;
  }

  return {
    type: 'CommentBlock',
    value: commentText
  } as t.CommentBlock;
}
