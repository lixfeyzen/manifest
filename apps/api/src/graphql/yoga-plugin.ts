import { maxAliasesPlugin } from '@escape.tech/graphql-armor-max-aliases';
import { maxDepthPlugin } from '@escape.tech/graphql-armor-max-depth';
import { maxTokensPlugin } from '@escape.tech/graphql-armor-max-tokens';
import { DomainError } from '@manifest/domain';
import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { GraphQLError } from 'graphql';
import { createSchema, createYoga } from 'graphql-yoga';
import { useDisableIntrospection as disableIntrospection } from '@graphql-yoga/plugin-disable-introspection';
import { env } from '../env.js';
import { readSessionToken } from '../rest/auth.js';
import { getUserBySessionToken } from '../services/auth-service.js';
import { resolvers } from './resolvers.js';
import { typeDefs } from './schema.js';

/**
 * Mounts GraphQL Yoga onto Fastify at /graphql.
 *
 * Yoga needs to read the raw request body itself, but Fastify's default JSON
 * parser would consume it first. Fastify content-type parsers are *encapsulated*
 * per plugin scope, so the no-op parser added here only affects the /graphql
 * route, the REST webhook in the parent scope keeps its normal JSON parsing.
 */
export const graphqlPlugin: FastifyPluginAsync = async (app) => {
  const yoga = createYoga<{ req: FastifyRequest; reply: FastifyReply }>({
    schema: createSchema({ typeDefs, resolvers }),
    graphqlEndpoint: '/graphql',
    // GraphiQL explorer in development only.
    graphiql: env.NODE_ENV === 'development',
    landingPage: false,
    // Error contract: domain errors always surface their stable code + message so a
    // client can tell (e.g.) a not-found from a validation failure, even in
    // production. Anything else is masked in production and shown in dev/test.
    maskedErrors: {
      maskError(error: unknown, message: string): Error {
        const original = (error as { originalError?: unknown }).originalError ?? error;
        if (original instanceof DomainError) {
          return new GraphQLError(original.message, { extensions: { code: original.code } });
        }
        return env.NODE_ENV === 'production' ? new GraphQLError(message) : (error as Error);
      },
    },
    plugins: [
      // Bound query depth / aliases / token count so an abusive query can't exhaust
      // the server. Limits are generous enough for real queries and GraphiQL
      // introspection; in production introspection is off anyway.
      maxDepthPlugin({ n: 10, ignoreIntrospection: true }),
      maxAliasesPlugin({ n: 25 }),
      maxTokensPlugin({ n: 3000 }),
      // Hide the schema from the public in production.
      ...(env.NODE_ENV === 'production' ? [disableIntrospection()] : []),
    ],
  });

  // Pass bodies through untouched so Yoga can parse them from the raw stream.
  app.addContentTypeParser('application/json', {}, (_req, _payload, done) => done(null));
  app.addContentTypeParser('multipart/form-data', {}, (_req, _payload, done) => done(null));

  const isDev = env.NODE_ENV === 'development';

  app.route({
    url: '/graphql',
    method: ['GET', 'POST', 'OPTIONS'],
    // Require a valid session for GraphQL operations. In development only the
    // parameterless GET that serves the GraphiQL explorer HTML is allowed through
    // so the tool still loads, a GET carrying a query still requires a session
    // (graphql-yoga executes queries sent over GET).
    //
    // Authorization model: Manifest is a single-operator / staff ops console, so
    // every authenticated staff member is intentionally allowed to see and act on
    // ALL orders (a shared fulfillment queue): authentication is authorization
    // here. A per-user ownership model would be wrong for this domain. See
    // docs/adr/005-authorization.md.
    preHandler: async (req, reply) => {
      if (req.method === 'OPTIONS') return;
      if (isDev && req.method === 'GET' && !(req.query as { query?: string } | undefined)?.query)
        return;
      const user = await getUserBySessionToken(readSessionToken(req));
      if (!user) {
        return reply.status(401).send({ errors: [{ message: 'Unauthorized' }] });
      }
    },
    handler: async (req, reply) => {
      const response = await yoga.handleNodeRequestAndResponse(req, reply, { req, reply });
      response.headers.forEach((value, key) => reply.header(key, value));
      reply.status(response.status);
      reply.send(response.body);
      return reply;
    },
  });
};
