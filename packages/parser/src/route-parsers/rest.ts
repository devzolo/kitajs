import { KitaConfig, ParameterParser, Route, RouteParser } from '@kitajs/common';
import ts from 'typescript';
import { SchemaBuilder } from '../schema/builder';
import { mergeSchema } from '../schema/helpers';
import { parseJsDocTags } from '../util/jsdoc';
import { getReturnType, isExportedFunction, toPrettySource } from '../util/nodes';
import { findUrlAndControllerName } from '../util/string';
import { traverseParameters } from '../util/traverser';

export class RestRouteParser implements RouteParser {
  constructor(
    readonly config: KitaConfig,
    readonly schema: SchemaBuilder,
    readonly paramParser: ParameterParser,
    readonly typeChecker: ts.TypeChecker
  ) {}

  supports(node: ts.Node): boolean {
    if (!isExportedFunction(node)) {
      return false;
    }

    if (!node.name || !node.getSourceFile()) {
      return false;
    }

    // Allows this parameter to not be defined as this is the last
    // resolver and should try to catch as many routes as possible.
    if (!node.name.text.trim().match(/^(get|post|put|delete|all)Route$/i)) {
      return false;
    }

    // TODO: Check if the present this parameter is a Route<> type.
    return true;
  }

  async parse(node: ts.FunctionDeclaration): Promise<Route> {
    const source = node.getSourceFile();

    const { url, controller } = findUrlAndControllerName(source.fileName, this.config);
    const method = node.name!.getText();

    const route: Route = {
      url,
      controllerMethod: method,
      method: method.toUpperCase() as Uppercase<string>,
      controllerName: controller,
      controllerPath: source.fileName,
      controllerPrettyPath: toPrettySource(node),
      parameters: Array(node.parameters.length),
      schema: {
        operationId: method.toLowerCase() + controller,
        response: {}
      }
    };

    // Adds response type.
    mergeSchema(route, {
      response: {
        [this.config.schema.defaultResponse]: this.schema.consumeNodeSchema(
          getReturnType(node, this.typeChecker),
          `${route.schema.operationId}Response`
        )
      }
    });

    // Merge all predefined responses.
    for (const status in this.config.schema.responses) {
      mergeSchema(route, {
        response: {
          [status]: this.config.schema.responses[status]
        }
      });
    }

    // Parses all jsdoc functions
    parseJsDocTags(node, route);

    // Adds all parameters in their respective position
    for await (const { param, index } of traverseParameters(node, this.paramParser, route)) {
      route.parameters[index] = param;
    }

    return route;
  }
}