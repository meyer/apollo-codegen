import {
  GraphQLEnumType,
  GraphQLInputObjectType
} from 'graphql';

import {
  CompilerOptions
} from '../../compiler';


import {
  sortEnumValues
} from '../../utilities/graphql';

import { createTypeFromGraphQLTypeFunction, convertStringToDocstringComment,  } from './helpers';

import * as t from '@babel/types';
import { GraphQLScalarType } from 'graphql';

export type ObjectProperty = {
  name: string,
  description?: string | null | undefined,
  type: t.TSType
}

export interface TypescriptCompilerOptions extends CompilerOptions {
  // Leaving this open for Typescript only compiler options
}

export default class TypescriptGenerator {
  options: TypescriptCompilerOptions
  typeFromGraphQLType: Function

  constructor(compilerOptions: TypescriptCompilerOptions) {
    this.options = compilerOptions;

    this.typeFromGraphQLType = createTypeFromGraphQLTypeFunction(compilerOptions);
  }

  public scalarDeclaration(scalarType: GraphQLScalarType) {
    const { name, description } = scalarType;
    const scalarDeclaration = t.exportNamedDeclaration(
      t.TSTypeAliasDeclaration(
        t.identifier(name),
        undefined,
        t.TSAnyKeyword()
      ),
      []
    );

    if (description) {
      const leadingComment = convertStringToDocstringComment(description);
      if (leadingComment) {
        scalarDeclaration.leadingComments = [leadingComment];
      }
    }

    return scalarDeclaration;
  }

  public enumerationDeclaration(type: GraphQLEnumType) {
    const { name, description } = type;
    const enumMembers = sortEnumValues(type.getValues()).map(({ value }) => {
      return t.TSEnumMember(
        t.identifier(value),
        t.stringLiteral(value)
      );
    });

    const typeAlias = t.exportNamedDeclaration(
      t.TSEnumDeclaration(
        t.identifier(name),
        enumMembers
      ),
      []
    );

    if (description) {
      const leadingComment = convertStringToDocstringComment(description);
      if (leadingComment) {
        typeAlias.leadingComments = [leadingComment];
      }
    }

    return typeAlias;
  }

  public inputObjectDeclaration(inputObjectType: GraphQLInputObjectType) {
    const { name, description } = inputObjectType;

    const fieldMap = inputObjectType.getFields();
    const fields: ObjectProperty[] = Object.keys(inputObjectType.getFields())
      .map((fieldName: string) => {
        const field = fieldMap[fieldName];
        return {
          name: fieldName,
          type: this.typeFromGraphQLType(field.type)
        }
      });

    const inputType = this.exportDeclaration(this.interface(name, fields, {
      keyInheritsNullability: true
    }));

    if (description) {
      const leadingComment = convertStringToDocstringComment(description);
      if (leadingComment) {
        inputType.leadingComments = [leadingComment];
      }
    }

    return inputType;
  }

  public typesForProperties(fields: ObjectProperty[], {
    keyInheritsNullability = false
  } : {
    keyInheritsNullability?: boolean
  } = {}) {

    return fields.map(({name, description, type}) => {
      const propertySignatureType = t.TSPropertySignature(
        t.identifier(name),
        t.TSTypeAnnotation(type)
      );

      // TODO: Check if this works
      propertySignatureType.optional = keyInheritsNullability && this.isNullableType(type);

      if (description) {
        const leadingComment = convertStringToDocstringComment(description);
        if (leadingComment) {
          propertySignatureType.leadingComments = [leadingComment];
        }
      }

      return propertySignatureType;
    });
  }

  public interface(name: string, fields: ObjectProperty[], {
    keyInheritsNullability = false
  }: {
    keyInheritsNullability?: boolean
  } = {}) {

    return t.TSInterfaceDeclaration(
      t.identifier(name),
      undefined,
      undefined,
      t.TSInterfaceBody(
        this.typesForProperties(fields, {
          keyInheritsNullability
        })
      )
    );
  }

  public typeAliasGenericUnion(name: string, members: t.TSType[]) {
    return t.TSTypeAliasDeclaration(
      t.identifier(name),
      undefined,
      t.TSUnionType(
        members
      )
    );
  }

  public exportDeclaration(declaration: t.Declaration) {
    return t.exportNamedDeclaration(declaration, []);
  }

  public nameFromScopeStack(scope: string[]) {
    return scope.join('_');
  }

  public makeNullableType(type: t.TSType) {
    return t.TSUnionType([
      type,
      t.TSNullKeyword()
    ])
  }

  public isNullableType(type: t.TSType) {
    return t.isTSUnionType(type) && type.types.some(type => t.isTSNullKeyword(type));
  }
}
