const { DataTypes } = require("sequelize");

const sequelize = require("../database/database");

const User = sequelize.define("User", {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true,
  },

  spotifyId: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },

  displayName: {
    type: DataTypes.STRING,
    allowNull: false,
  },

  email: {
    type: DataTypes.STRING,
    allowNull: true,
  },

  accessToken: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  refreshToken: {
    type: DataTypes.TEXT,
    allowNull: true,
  },

  tokenExpiresAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },

  jwtToken: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
});

module.exports = User;
