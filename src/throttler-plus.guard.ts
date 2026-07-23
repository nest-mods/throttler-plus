import { type ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerRequest } from '@nestjs/throttler';

// deno-lint-ignore no-explicit-any -- Matches the upstream Guard signature.
type RequestRecord = Record<string, any>;

interface GraphqlRequestContext {
  req: RequestRecord;
  res?: RequestRecord;
}

interface GraphqlRuntimeModule {
  GqlExecutionContext: {
    create(context: ExecutionContext): {
      getContext(): GraphqlRequestContext;
    };
  };
}

@Injectable()
export class ThrottlerPlusGuard extends ThrottlerGuard {
  #graphqlModulePromise?: Promise<GraphqlRuntimeModule>;
  #graphqlModule?: GraphqlRuntimeModule;

  protected override async handleRequest(
    requestProps: ThrottlerRequest,
  ): Promise<boolean> {
    if (requestProps.context.getType<string>() === 'graphql') {
      this.#graphqlModule = await this.#loadGraphqlModule();
    }

    return super.handleRequest(requestProps);
  }

  protected override getRequestResponse(context: ExecutionContext): {
    req: RequestRecord;
    res: RequestRecord;
  } {
    if (context.getType<string>() !== 'graphql') {
      return super.getRequestResponse(context);
    }

    const gqlContext = this.#graphqlModule?.GqlExecutionContext.create(context)
      .getContext();
    if (!gqlContext) {
      throw new Error(
        'GraphQL support was not loaded before request handling.',
      );
    }

    return {
      req: gqlContext.req,
      res: gqlContext.res ?? gqlContext.req.res,
    };
  }

  #loadGraphqlModule(): Promise<GraphqlRuntimeModule> {
    this.#graphqlModulePromise ??= import('@nestjs/graphql')
      .then(({ GqlExecutionContext }) => ({ GqlExecutionContext }))
      .catch((cause: unknown) => {
        throw new Error(
          'GraphQL throttling requires both optional peers "@nestjs/graphql" and "graphql". Install both packages before handling GraphQL requests.',
          { cause },
        );
      });

    return this.#graphqlModulePromise;
  }
}
