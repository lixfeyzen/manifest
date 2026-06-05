import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import { createSchema, createYoga } from 'graphql-yoga';
import { env } from '../env.js';
import { resolvers } from './resolvers.js';
import { typeDefs } from './schema.js';

/**
 * Mounts GraphQL Yoga onto Fastify at /graphql.
 *
 * Yoga needs to read the raw request body itself, but Fastify's default JSON
 * parser would consume it first. Fastify content-type parsers are *encapsulated*
 * per plugin scope, so the no-op parser added here only affects the /graphql
 * route — the REST webhook in the parent scope keeps its normal JSON parsing.
 */
export const graphqlPlugin: FastifyPluginAsync = async (app) => {
  const yoga = createYoga<{ req: FastifyRequest; reply: FastifyReply }>({
    schema: createSchema({ typeDefs, resolvers }),
    graphqlEndpoint: '/graphql',
    // GraphiQL explorer in development only.
    graphiql: env.NODE_ENV === 'development',
    landingPage: false,
    // Mask error details in production for safety; surface real messages in
    // development/test so business errors (e.g. "Unknown SKU") are visible.
    maskedErrors: env.NODE_ENV === 'production',
  });

  // Pass bodies through untouched so Yoga can parse them from the raw stream.
  app.addContentTypeParser('application/json', {}, (_req, _payload, done) => done(null));
  app.addContentTypeParser('multipart/form-data', {}, (_req, _payload, done) => done(null));

  app.route({
    url: '/graphql',
    method: ['GET', 'POST', 'OPTIONS'],
    handler: async (req, reply) => {
      const response = await yoga.handleNodeRequestAndResponse(req, reply, { req, reply });
      response.headers.forEach((value, key) => reply.header(key, value));
      reply.status(response.status);
      reply.send(response.body);
      return reply;
    },
  });
};
