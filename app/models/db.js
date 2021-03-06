'use strict';

const Sequelize = require('sequelize');
const rfr = require('rfr');
const config = rfr('config/DbConfig');

function Db() {
  const sequelize = new Sequelize(
      config.name,
      config.username,
      config.password, {
        host: config.host,
        dialect: config.dialect,
        dialectOptions: config.dialectOptions,
        logging: false
      });

  const User = sequelize.define('user', {
    id: {
      type: Sequelize.STRING,
      unique: true,
      allowNull: false,
      primaryKey: true
    },
    public: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
    tagScore: {
      type: Sequelize.BLOB,
      allowNull: true
    }
  }, {
    freezeTableName: true // Model tableName will be the same as the model name
  });

  const Game = sequelize.define('game', {
    id: {
      type: Sequelize.INTEGER,
      unique: true,
      allowNull: false,
      primaryKey: true
    },
    index: { // index of the game in the comparison vector
      type: Sequelize.INTEGER,
      unique: true,
      allowNull: false
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false
    },
    image: {
      type: Sequelize.STRING,
      allowNull: true
    },
    players: {
      type: Sequelize.ENUM('single', 'multi', 'coop'),
      allowNull: false
    }
  });

  const Tag = sequelize.define('tag', {
    id: {
      type: Sequelize.INTEGER,
      unique: true,
      allowNull: false,
      primaryKey: true
    },
    name: {
      type: Sequelize.STRING,
      allowNull: false
    }
  });

  const UserGames = sequelize.define('userGames', {
    owned: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
    followed: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
    wishlist: {
      type: Sequelize.BOOLEAN,
      defaultValue: false
    },
    reviewed: {
      type: Sequelize.ENUM('pos', 'neg'),
      allowNull: true
    },
    playtime: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    }
  });

  const GameTags = sequelize.define('gameTags');

  const Post = sequelize.define('post', {
    id: {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    content: {
      type: Sequelize.TEXT,
      defaultValue: ''
    },
    relatedGame: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    poster: {
      type: Sequelize.STRING,
      allowNull: false
    }
  });

  Post.belongsTo(Game, {
      foreignKey: 'relatedGame'
  });
  Post.belongsTo(User, {
      foreignKey: 'poster'
  });

  User.belongsToMany(User, {through: 'friends', as: 'Friends'});

  User.belongsToMany(Game, {through: UserGames});
  Game.belongsToMany(User, {through: UserGames});

  Game.belongsToMany(Tag, {through: GameTags});
  Tag.belongsToMany(Game, {through: GameTags});

  this.sync = () => sequelize.sync().then(() => {
    let utf8mb4Query = 'ALTER TABLE sgb.games CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;';
    return sequelize.query(utf8mb4Query, {type: sequelize.QueryTypes.RAW});
  }).then(() => {
        console.log('DB synced.');
      }, (err) => {
        console.log(err);
      }
  );

  this.models = {
    'user': User,
    'game': Game,
    'tag': Tag,
    'post': Post,
    'userGames': UserGames,
    'gameTags': GameTags
  };
}

module.exports = new Db();
