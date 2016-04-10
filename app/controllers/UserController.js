'use strict';

const rfr = require('rfr');
const openid = require('openid');
const Db = rfr('app/models/db');
const Crawler = rfr('app/Crawler');
const Recommender = rfr('app/recommender/recommender');

const steamOpenIdUrl = 'http://steamcommunity.com/openid';

function UserController (server, options) {
  this.server = server;
  this.options = options;
  this.relyingParty = new openid.RelyingParty(
      server.info.uri + '/api/user/login/verify',
      server.info.uri, true, false, []
  );
}

const Class = UserController.prototype;

Class.registerRoutes = function () {
  this.server.route({
    method: 'GET',
    path: '/',
    config: {
      auth: {
        mode: 'try'
      }
    },
    handler: getUser
  });

  this.server.route({
    method: 'GET',
    path: '/recommend',
    handler: getOwnRecommendation
  });

  this.server.route({
    method: 'GET',
    path: '/{userId}/recommend',
    handler: getFriendRecommendation
  });

  this.server.route({
    method: 'GET',
    path: '/games',
    handler: getOwnGames
  });

  this.server.route({
    method: 'GET',
    path: '/{userId}/profile',
    handler: getUserProfile
  });

  this.server.route({
    method: 'GET',
    path: '/{userId}/games',
    handler: getUserGames
  });

  this.server.route({
    method: 'GET',
    path: '/friends',
    handler: getOwnFriends
  });

  this.server.route({
    method: 'GET',
    path: '/{userId}/friends',
    handler: getUserFriends
  });

  this.server.route({
    method: 'GET',
    path: '/login',
    config: {
      auth: {
        mode: 'try'
      }
    },
    handler: login
  });

  this.server.route({
    method: 'GET',
    path: '/login/verify',
    config: {
      auth: {
        mode: 'try'
      }
    },
    handler: verify
  });

  this.server.route({
    method: 'GET',
    path: '/logout',
    handler: logout
  });
};

const getUser = function (request, reply) {
  if (!request.auth.isAuthenticated) {
    return reply({success: false});
  }
  let user = request.auth.credentials.userId;
  reply({success: true, id: user});
};

const getOwnRecommendation = function (request, reply) {
  request.params.userId = request.auth.credentials.userId;
  getFriendRecommendation(request, reply);
};

const getFriendRecommendation = function (request, reply) {
  let userId = request.params.userId;

  let getUserTags = (user) => {

    //console.log('user - ', user.id);
    return {
      userId: user.id,
      games: Promise.all(user.games.map((game) => Db.models.game.findById(game.id, {
        include: [{
          model: Db.models.tag
        }]
      }).then((g) => {
        return {
          index: g.index,
          minutesPlayed: game.userGames.minutesPlayed,
          tags: g.tags.map((tag) => tag.id)
        };
      })))
    };
  };

  let userGameIncludes = [{
    model: Db.models.game,
    through: {attributes: ['playtime']}
  }];

  let userGames = Db.models.user.findById(userId, {
    include: userGameIncludes
  }).then(getUserTags);

  let usersGames = Db.models.user.findAll({
    where: {id: {ne: userId}},
    include: userGameIncludes
  }).then((users) => users.map(getUserTags));

  Promise.all([userGames, usersGames]).then((users) => {
    let user = users[0];
    users = users[1];

    Promise.all([user.games, Promise.all(users.map((u) => u.games))]).then((games) => {
      let recommendations = Recommender.recommend(
          Recommender.buildTopicsVector(games[0]),
          games[1].map((g) => Recommender.buildTopicsVector(g))
      );

      let rUsers = recommendations.slice(0, 3).map((r) => users[r.index].userId);
      console.log(rUsers, recommendations.slice(0, 3));

      reply(rUsers);
    });

  }).catch(console.log);
};

const getUserProfile = function (request, reply) {
  Promise.all([
    Crawler.getUserProfile(request.params.userId),
    Crawler.getUserOwnedGames(request.params.userId, true)
  ]).then(function (data) {
    let users = data[0];
    if (users.length < 1) {
      return reply({success: false, error: 'User does not exist.'});
    }
    let user = users[0];
    let games = data[1];
    user.games = games;
    Db.models.post.findAll({where: {poster: request.params.userId}, order: [['createdAt', 'DESC']], include: [Db.models.game]}).then(function (posts) {
      user.posts = posts;
      reply({success: true, data: user});
    });
  });
};

const getOwnGames = function (request, reply) {
  request.params.userId = request.auth.credentials.userId;
  getUserGames(request, reply);
};

const getUserGames = function (request, reply) {
  Promise.all([
    Crawler.getUserOwnedGames(request.params.userId, false),
    Crawler.getUserFollowedGames(request.params.userId),
    Crawler.getUserWishlistGames(request.params.userId),
    Crawler.getUserReviewedGames(request.params.userId)
  ]).then((games) => {
    return games[0] ? {
      owned: games[0] || [],
      followed: games[1] || [],
      wishlist: games[2] || [],
      reviewed: games[3] || []
    } : {private: true}
  }).then((gameCategories) => {
    if (gameCategories.private) {
      return reply(gameCategories);
    }

    Db.models.game.findAll().then((allGames) => allGames.map((g) => g.id)).then((allGames) => {
      let games = {};

      gameCategories.owned.forEach((game) => {
        games[game.id] = games[game.id] || {};
        games[game.id].owned = true;
        games[game.id].playtime = game.playtime.total
      });
      gameCategories.followed.forEach((game) => {
        games[game.id] = games[game.id] || {};
        games[game.id].followed = true;
      });
      gameCategories.wishlist.forEach((game) => {
        games[game.id] = games[game.id] || {};
        games[game.id].wishlist = true;
      });
      gameCategories.reviewed.forEach((game) => {
        games[game.id] = games[game.id] || {};
        games[game.id].reviewed = game.isPositive ? 'pos' : 'neg';
      });

      let userGameRecords = Object.keys(games).map((id) => {
        return {
          userId: request.params.userId,
          gameId: parseInt(id),
          owned: games[id].owned,
          followed: games[id].followed,
          wishlist: games[id].wishlist,
          reviewed: games[id].reviewed,
          playtime: games[id].playtime
        };
      }).filter((r) => allGames.indexOf(r.gameId) > -1);

      Db.models.userGames.bulkCreate(userGameRecords, {
        updateOnDuplicate: true
      });
    }).then(() => reply(gameCategories));
  }).catch(console.log);
};

const getOwnFriends = function (request, reply) {
  request.params.userId = request.auth.credentials.userId;
  getUserFriends(request, reply);
};

const getUserFriends = function (request, reply) {
  Crawler.getUserFriends(request.params.userId).then(
      (friends) => reply(friends || {private: true}),
      (err) => reply(err)
  );
};

const login = function (request, reply) {
  if (request.auth.isAuthenticated) {
    return reply.redirect('/');
  }

  this.relyingParty.authenticate(steamOpenIdUrl, false, function (err, authUrl) {
    if (err) {
      console.log(err);
      throw err;
    }

    reply.redirect(authUrl);
  });
};

const verify = function (request, reply) {
  if (request.auth.isAuthenticated) {
    return reply.redirect('/');
  }

  let claimedId = request.query['openid.claimed_id'];
  if (claimedId) {
    let id = claimedId.replace(steamOpenIdUrl + '/id/', '');
    request.cookieAuth.set({
      userId: id
    });

    // create new user if one doesn't exist
    Db.models.user.upsert({id: id});
  }

  reply.redirect('/');
};

const logout = function (request, reply) {
  request.cookieAuth.clear();
  reply.redirect('/');
};

exports.register = function (server, options, next) {
  const userController = new UserController(server, options);
  server.bind(userController);
  userController.registerRoutes();
  next();
};

exports.register.attributes = {
  name: 'UserController'
};
