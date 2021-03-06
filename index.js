'use strict';

const Hapi = require('hapi');
const rfr = require('rfr');
const Db = rfr('app/models/db');
const config = rfr('config/ServerConfig');

const server = new Hapi.Server();
server.connection(config.server);

const registerAuth = () => {
  return server.register(require('hapi-auth-cookie')).then((err) => {
    if (err) {
      console.log(err);
      throw err;
    }

    const authByDefault = true;
    server.auth.strategy('session', 'cookie', authByDefault, config.auth);
  });
};

const registerRoutes = () => {
  return Promise.all([
    server.register(require('inert')).then((err) => {
      if (err) {
        throw err;
      }

      server.route({
        method: 'GET',
        path: '/{param*}',
        config: {
          auth: false
        },
        handler: {
          directory: {
            path: 'public',
            index: 'index.htm'
          }
        }
      });
    }),

    server.register({
      register: rfr('app/controllers/UserController.js')
    }, {
      routes: {prefix: '/api/user'}
    }, (err) => {
      if (err) {
        console.log('Unable to register UserController');
        throw err;
      }
    }),

    server.register({
      register: rfr('app/controllers/GameController.js')
    }, {
      routes: {prefix: '/api/game'}
    }, (err) => {
      if (err) {
        console.log('Unable to register GameController');
        throw err;
      }
    }),

    server.register({
      register: rfr('app/controllers/PostController.js')
    }, {
      routes: {prefix: '/api/post'}
    }, (err) => {
      if (err) {
        console.log('Unable to register PostController');
        throw err;
      }
    })
  ]);
};

registerAuth()
    .then(() => registerRoutes())
    .then(() => Db.sync())
    .then(() => server.start())
    .then((err) => {
      if (err) {
        throw err;
      }

      console.log('Server running at:', server.info.uri);
    });
